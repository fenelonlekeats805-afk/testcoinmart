// Sources (checked 2026-02-12):
// - ERC-20 Transfer event: https://eips.ethereum.org/EIPS/eip-20
// - ethers v6 provider/getLogs/getBlockNumber: https://docs.ethers.org/v6/api/providers/
import { Prisma, PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();
const transferInterface = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const chain = 'BASE' as const;
const rpcUrl = process.env.BASE_RPC_URL;
const pollMs = Number(process.env.BASE_WATCH_POLL_MS || 5000);
const confirmThreshold = Number(process.env.BASE_CONFIRM_THRESHOLD || 12);
const startupLookbackBlocks = Number(process.env.BASE_STARTUP_LOOKBACK_BLOCKS || 1200);
const scanStep = Math.max(1, Number(process.env.BASE_LOG_BLOCK_STEP || 20));
const addressChunkSize = Number(process.env.BASE_LOG_ADDRESS_CHUNK || 10);
const scanDelayMs = Number(process.env.BASE_LOG_REQUEST_DELAY_MS || 250);

if (!rpcUrl) {
  throw new Error('Missing BASE_RPC_URL');
}

// Source: ethers v6 JsonRpcApiProviderOptions `batchMaxCount`; set to 1 to disable batching (checked 2026-02-13)
// https://docs.ethers.org/v6/api/providers/jsonrpc/
const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
const transferTopic = ethers.id('Transfer(address,address,uint256)');

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function addressToTopic(address: string): string {
  return ethers.zeroPadValue(address.toLowerCase(), 32);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRangeError(error: unknown): boolean {
  const text = String((error as any)?.shortMessage || (error as any)?.message || '').toLowerCase();
  return text.includes('invalid block range')
    || text.includes('up to a 10 block range')
    || text.includes('limit exceeded');
}

async function getLogsWithFallback(params: {
  address: string;
  fromBlock: number;
  toBlock: number;
  topics: Array<string | null | string[]>;
}) {
  try {
    return await provider.getLogs(params);
  } catch (error) {
    if (!isRangeError(error) || params.fromBlock === params.toBlock) {
      throw error;
    }

    const merged: ethers.Log[] = [];
    for (let block = params.fromBlock; block <= params.toBlock; block += 1) {
      const part = await provider.getLogs({
        address: params.address,
        fromBlock: block,
        toBlock: block,
        topics: params.topics,
      });
      merged.push(...part);
      if (scanDelayMs > 0) {
        await sleep(scanDelayMs);
      }
    }
    return merged;
  }
}

async function applyPaymentTransition(params: {
  orderId: string;
  txHash: string;
  tokenContract: string;
  toAddress: string;
  rawAmount: string;
  blockNumber: number;
  confirmations: number;
}) {
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${params.orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: params.orderId } });
      if (!order) {
        return;
      }

      const existingByTx = await tx.payment.findUnique({ where: { txHash: params.txHash } });
      if (existingByTx) {
        await tx.payment.update({
          where: { txHash: params.txHash },
          data: {
            confirmations: params.confirmations,
            confirmedAt: params.confirmations >= confirmThreshold ? (existingByTx.confirmedAt || new Date()) : existingByTx.confirmedAt,
          },
        });

        if (params.confirmations >= confirmThreshold && order.status === 'PAYMENT_DETECTED') {
          await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_CONFIRMED' } });
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              eventType: 'PAYMENT_CONFIRMED',
              payload: { txHash: params.txHash, chain, confirmations: params.confirmations },
            },
          });
        }
        return;
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          chain,
          txHash: params.txHash,
          blockNumber: BigInt(params.blockNumber),
          confirmations: params.confirmations,
          tokenContract: params.tokenContract.toLowerCase(),
          toAddress: params.toAddress.toLowerCase(),
          rawAmount: params.rawAmount,
          confirmedAt: params.confirmations >= confirmThreshold ? new Date() : null,
        },
      });

      const paymentCount = await tx.payment.count({ where: { orderId: order.id } });
      if (paymentCount > 1) {
        const nextStatus = ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED'].includes(order.status)
          ? 'EXTRA_PAYMENT'
          : order.status;

        await tx.order.update({
          where: { id: order.id },
          data: {
            extraPaymentFlag: true,
            status: nextStatus,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: 'EXTRA_PAYMENT',
            payload: { txHash: params.txHash, chain, toAddress: params.toAddress, rawAmount: params.rawAmount },
          },
        });
        return;
      }

      if (order.status === 'EXPIRED') {
        await tx.order.update({
          where: { id: order.id },
          data: {
            latePaymentFlag: true,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: 'LATE_PAYMENT',
            payload: { txHash: params.txHash, chain, confirmations: params.confirmations },
          },
        });
        return;
      }

      if (params.confirmations >= confirmThreshold) {
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_CONFIRMED' } });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: 'PAYMENT_CONFIRMED',
            payload: { txHash: params.txHash, chain, confirmations: params.confirmations },
          },
        });
      } else if (order.status === 'PENDING_PAYMENT') {
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_DETECTED' } });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: 'PAYMENT_DETECTED',
            payload: { txHash: params.txHash, chain, confirmations: params.confirmations },
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function processTransfer(
  tokenContract: string,
  txHash: string,
  blockNumber: number,
  toAddress: string,
  rawAmount: string,
  confirmations: number,
) {
  const row = await prisma.orderPaymentAddress.findFirst({
    where: {
      chain,
      tokenContract: tokenContract.toLowerCase(),
      address: { equals: toAddress, mode: 'insensitive' },
      expectedRawAmount: rawAmount,
      order: {
        status: {
          in: ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
        },
      },
    },
    include: { order: true },
  });

  if (!row) {
    return;
  }

  await applyPaymentTransition({
    orderId: row.orderId,
    txHash,
    tokenContract,
    toAddress,
    rawAmount,
    blockNumber,
    confirmations,
  });
}

async function refreshConfirmations(currentBlock: number) {
  const payments = await prisma.payment.findMany({
    where: {
      chain,
      confirmations: { lt: confirmThreshold },
    },
    select: {
      txHash: true,
      blockNumber: true,
      orderId: true,
      tokenContract: true,
      toAddress: true,
      rawAmount: true,
      confirmations: true,
    },
    take: 200,
  });

  for (const payment of payments) {
    const confirmations = currentBlock - Number(payment.blockNumber) + 1;
    if (confirmations <= payment.confirmations) {
      continue;
    }

    await applyPaymentTransition({
      orderId: payment.orderId,
      txHash: payment.txHash,
      tokenContract: payment.tokenContract,
      toAddress: payment.toAddress,
      rawAmount: payment.rawAmount,
      blockNumber: Number(payment.blockNumber),
      confirmations,
    });
  }
}

async function scanContract(tokenContract: string, currentBlock: number, addresses: string[]) {
  if (addresses.length === 0) {
    return;
  }

  const addressTopics = addresses.map(addressToTopic);
  const cursor = await prisma.watcherCursor.findUnique({
    where: {
      chain_tokenContract: {
        chain,
        tokenContract,
      },
    },
  });

  let fromBlock = cursor ? Number(cursor.lastScannedBlock) + 1 : Math.max(0, currentBlock - startupLookbackBlocks);
  if (fromBlock > currentBlock) {
    return;
  }

  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(currentBlock, fromBlock + scanStep - 1);
    for (const topicChunk of chunk(addressTopics, addressChunkSize)) {
      const logs = await getLogsWithFallback({
        address: tokenContract,
        fromBlock,
        toBlock,
        // Source: EIP-20 Transfer(address indexed from, address indexed to, uint256 value), checked 2026-02-13
        topics: [transferTopic, null, topicChunk],
      });

      for (const log of logs) {
        const parsed = transferInterface.parseLog(log);
        if (!parsed) {
          continue;
        }
        const to = String(parsed.args.to).toLowerCase();
        const value = parsed.args.value.toString();
        const confirmations = currentBlock - Number(log.blockNumber) + 1;

        await processTransfer(tokenContract, log.transactionHash, Number(log.blockNumber), to, value, confirmations);
      }

      if (scanDelayMs > 0) {
        await sleep(scanDelayMs);
      }
    }

    await prisma.watcherCursor.upsert({
      where: {
        chain_tokenContract: {
          chain,
          tokenContract,
        },
      },
      create: {
        chain,
        tokenContract,
        lastScannedBlock: BigInt(toBlock),
      },
      update: {
        lastScannedBlock: BigInt(toBlock),
      },
    });

    fromBlock = toBlock + 1;
  }
}

async function loop() {
  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const activeRows = await prisma.orderPaymentAddress.findMany({
        where: {
          chain,
          order: {
            status: {
              in: ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
            },
          },
        },
        select: { tokenContract: true, address: true },
      });

      const byToken = new Map<string, Set<string>>();
      for (const row of activeRows) {
        const token = row.tokenContract.toLowerCase();
        const address = row.address.toLowerCase();
        if (!byToken.has(token)) {
          byToken.set(token, new Set());
        }
        byToken.get(token)!.add(address);
      }

      for (const [token, addressSet] of byToken.entries()) {
        await scanContract(token, currentBlock, Array.from(addressSet));
      }

      await refreshConfirmations(currentBlock);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[watcher-base] scan failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[watcher-base] fatal', error);
  process.exit(1);
});


