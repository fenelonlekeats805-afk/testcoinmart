// Sources (checked 2026-02-12):
// - TronWeb event query (`getEventResult`): https://tronweb.network/docu/docs/API%20List/utils/getEventResult/
// - TRC-20 interaction basics: https://developers.tron.network/docs/trc20-contract-interaction
// - Transaction APIs and block metadata: https://developers.tron.network/reference/gettransactionbyid
import { Prisma, PrismaClient } from '@prisma/client';
import { TronWeb } from 'tronweb';

const prisma = new PrismaClient();
const chain = 'TRON' as const;
const pollMs = Number(process.env.TRON_WATCH_POLL_MS || 12000);
const confirmThreshold = Number(process.env.TRON_CONFIRM_THRESHOLD || 20);
const tronFullHost = process.env.TRON_FULL_HOST;
const tronApiKey = process.env.TRON_API_KEY;
const tronEventLimit = Number(process.env.TRON_EVENT_LIMIT || 120);
const tronStartupLookbackMs = Number(process.env.TRON_STARTUP_LOOKBACK_MS || 10 * 60 * 1000);
const tronScanDelayMs = Number(process.env.TRON_SCAN_DELAY_MS || 300);
const tronUsdtContract = process.env.TRON_USDT_CONTRACT;

if (!tronFullHost) {
  throw new Error('Missing TRON_FULL_HOST');
}
if (!tronUsdtContract) {
  throw new Error('Missing TRON_USDT_CONTRACT');
}

const tronWeb = new TronWeb({
  fullHost: tronFullHost,
  // Source (checked 2026-02-13): TRON API key header guidance for higher quota.
  // https://developers.tron.network/reference/select-network#how-to-get-an-api-key
  headers: tronApiKey ? { 'TRON-PRO-API-KEY': tronApiKey } : undefined,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTronAddress(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return raw;
  }

  try {
    if (/^(0x)?41[a-fA-F0-9]{40}$/.test(raw)) {
      const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
      return tronWeb.address.fromHex(hex);
    }
  } catch {
    return raw;
  }

  return raw;
}

function normalizeTronContractAddress(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return raw;
  }

  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw)) {
    return raw;
  }

  try {
    if (/^(0x)?41[a-fA-F0-9]{40}$/.test(raw)) {
      const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
      return tronWeb.address.fromHex(hex);
    }
  } catch {
    return raw;
  }

  return raw;
}

function resolveTokenContractBySymbol(tokenSymbol: string): string | null {
  if (tokenSymbol === 'USDT') {
    return normalizeTronContractAddress(tronUsdtContract as string);
  }
  return null;
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

      const byTx = await tx.payment.findUnique({ where: { txHash: params.txHash } });
      if (byTx) {
        await tx.payment.update({
          where: { txHash: params.txHash },
          data: {
            confirmations: params.confirmations,
            confirmedAt: params.confirmations >= confirmThreshold ? (byTx.confirmedAt || new Date()) : byTx.confirmedAt,
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
          tokenContract: params.tokenContract,
          toAddress: params.toAddress,
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
        await tx.order.update({ where: { id: order.id }, data: { latePaymentFlag: true } });
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
  tokenSymbol: string,
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
      tokenSymbol,
      address: { equals: toAddress, mode: 'insensitive' },
      expectedRawAmount: rawAmount,
      order: {
        status: {
          in: ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
        },
      },
    },
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

async function scanContract(tokenSymbol: string, tokenContract: string, currentBlock: number) {
  const contractAddress = normalizeTronContractAddress(tokenContract);

  const cursor = await prisma.watcherCursor.findUnique({
    where: {
      chain_tokenContract: {
        chain,
        tokenContract: contractAddress,
      },
    },
  });

  const sinceTimestamp = cursor ? Number(cursor.lastScannedBlock) : Date.now() - tronStartupLookbackMs;

  // Source: https://tronweb.network/docu/docs/6.0.4/API%20List/event/getEventsByContractAddress
  // (checked 2026-02-12): contractAddress accepts base58/hex and uses minBlockTimestamp + orderBy.
  const eventsRaw = await tronWeb.event.getEventsByContractAddress(contractAddress, {
    eventName: 'Transfer',
    minBlockTimestamp: sinceTimestamp,
    orderBy: 'block_timestamp,asc',
    onlyConfirmed: false,
    limit: tronEventLimit,
  });
  const events = Array.isArray(eventsRaw)
    ? eventsRaw
    : Array.isArray((eventsRaw as any)?.data)
      ? (eventsRaw as any).data
      : [];

  let maxTimestamp = sinceTimestamp;

  for (const event of events || []) {
    const result = event?.result || {};
    const txHash = String(event?.transaction || '');
    const toAddress = normalizeTronAddress(String(result.to || ''));
    const rawAmount = String(result.value || '');
    const blockNumber = Number(event?.block || 0);
    const blockTimestamp = Number(event?.block_timestamp || sinceTimestamp);

    if (blockTimestamp > maxTimestamp) {
      maxTimestamp = blockTimestamp;
    }

    if (!txHash || !toAddress || !/^\d+$/.test(rawAmount) || blockNumber <= 0) {
      continue;
    }

    const confirmations = Math.max(0, currentBlock - blockNumber + 1);

    await processTransfer(tokenSymbol, contractAddress, txHash, blockNumber, toAddress, rawAmount, confirmations);
  }

  await prisma.watcherCursor.upsert({
    where: {
        chain_tokenContract: {
          chain,
          tokenContract: contractAddress,
        },
      },
      create: {
        chain,
        tokenContract: contractAddress,
        lastScannedBlock: BigInt(maxTimestamp),
      },
      update: {
      lastScannedBlock: BigInt(maxTimestamp),
    },
  });
}

async function loop() {
  while (true) {
    try {
      const currentBlockInfo = await tronWeb.trx.getCurrentBlock();
      const currentBlock = Number(currentBlockInfo?.block_header?.raw_data?.number || 0);

      const contracts = await prisma.orderPaymentAddress.findMany({
        where: {
          chain,
          order: {
            status: {
              in: ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
            },
          },
        },
        select: { tokenSymbol: true },
        distinct: ['tokenSymbol'],
      });

      for (const item of contracts) {
        const tokenContract = resolveTokenContractBySymbol(item.tokenSymbol);
        if (!tokenContract) {
          // eslint-disable-next-line no-console
          console.error('[watcher-tron] unsupported tokenSymbol in orderPaymentAddress', item.tokenSymbol);
          continue;
        }
        await scanContract(item.tokenSymbol, tokenContract, currentBlock);
        if (tronScanDelayMs > 0) {
          await sleep(tronScanDelayMs);
        }
      }

      await refreshConfirmations(currentBlock);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[watcher-tron] scan failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[watcher-tron] fatal', error);
  process.exit(1);
});


