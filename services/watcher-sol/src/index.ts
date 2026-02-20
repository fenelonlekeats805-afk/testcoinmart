// Sources (checked 2026-02-12):
// - Solana RPC methods (`getSignaturesForAddress`, `getTransaction`): https://solana.com/docs/rpc
// - SPL Associated Token Account derivation: https://spl.solana.com/associated-token-account
// - SPL token balance verification guidance: https://solana.com/docs/payments/accept-payments/verification-tools
import { Prisma, PrismaClient } from '@prisma/client';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const prisma = new PrismaClient();
const chain = 'SOL' as const;
const pollMs = Number(process.env.SOL_WATCH_POLL_MS || 7000);
const confirmThreshold = Number(process.env.SOL_CONFIRM_THRESHOLD || 32);
const rpcUrl = process.env.SOL_RPC_URL;
const signatureLimit = Number(process.env.SOL_SIGNATURE_LIMIT || 10);
const scanTargetLimit = Number(process.env.SOL_SCAN_TARGET_LIMIT || 120);
const scanDelayMs = Number(process.env.SOL_SCAN_DELAY_MS || 120);
const solUsdtMint = process.env.SOL_USDT_MINT;
const solUsdcMint = process.env.SOL_USDC_MINT;

if (!rpcUrl) {
  throw new Error('Missing SOL_RPC_URL');
}
if (!solUsdtMint) {
  throw new Error('Missing SOL_USDT_MINT');
}
if (!solUsdcMint) {
  throw new Error('Missing SOL_USDC_MINT');
}

const connection = new Connection(rpcUrl, {
  commitment: 'confirmed',
});

type ParsedTransfer = {
  destination: string;
  mint: string;
  rawAmount: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string): string {
  return value.trim();
}

function resolveMintBySymbol(tokenSymbol: string): string | null {
  if (tokenSymbol === 'USDT') {
    return normalize(solUsdtMint as string);
  }
  if (tokenSymbol === 'USDC') {
    return normalize(solUsdcMint as string);
  }
  return null;
}

function getCandidateDestinations(address: string, mint: string): string[] {
  const set = new Set<string>([normalize(address)]);

  try {
    const owner = new PublicKey(address);
    const mintPk = new PublicKey(mint);
    const ata = getAssociatedTokenAddressSync(mintPk, owner, true);
    set.add(ata.toBase58());
  } catch {
    // address may already be a token account and not an owner wallet.
  }

  return [...set];
}

function extractTransfers(parsedTx: any): ParsedTransfer[] {
  const transfers: ParsedTransfer[] = [];

  const accountKeys = (parsedTx?.transaction?.message?.accountKeys || []).map((item: any) =>
    typeof item === 'string' ? item : item.pubkey?.toString?.() || String(item.pubkey || ''),
  );
  const accountKeyIndex = new Map<string, number>();
  accountKeys.forEach((key: string, index: number) => {
    accountKeyIndex.set(key, index);
  });

  const tokenBalances = [
    ...(parsedTx?.meta?.preTokenBalances || []),
    ...(parsedTx?.meta?.postTokenBalances || []),
  ];
  const mintByAccountIndex = new Map<number, string>();
  for (const item of tokenBalances) {
    if (typeof item.accountIndex === 'number' && item.mint) {
      mintByAccountIndex.set(item.accountIndex, String(item.mint));
    }
  }

  function parseOne(ix: any): void {
    const parsed = ix?.parsed;
    const program = ix?.program;
    if (!parsed || (program !== 'spl-token' && program !== 'spl-token-2022')) {
      return;
    }

    const type = String(parsed.type || '');
    if (type !== 'transfer' && type !== 'transferChecked') {
      return;
    }

    const info = parsed.info || {};
    const destination = String(info.destination || '');
    if (!destination) {
      return;
    }

    const rawAmount = String(info.amount || info.tokenAmount?.amount || '');
    if (!/^\d+$/.test(rawAmount)) {
      return;
    }

    let mint = String(info.mint || '');
    if (!mint) {
      const idx = accountKeyIndex.get(destination);
      if (typeof idx === 'number') {
        mint = mintByAccountIndex.get(idx) || '';
      }
    }

    if (!mint) {
      return;
    }

    transfers.push({
      destination: normalize(destination),
      mint: normalize(mint),
      rawAmount,
    });
  }

  for (const ix of parsedTx?.transaction?.message?.instructions || []) {
    parseOne(ix);
  }

  for (const inner of parsedTx?.meta?.innerInstructions || []) {
    for (const ix of inner.instructions || []) {
      parseOne(ix);
    }
  }

  return transfers;
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
  slot: number,
  toAddress: string,
  rawAmount: string,
  confirmations: number,
) {
  const rows = await prisma.orderPaymentAddress.findMany({
    where: {
      chain,
      tokenSymbol,
      expectedRawAmount: rawAmount,
      order: {
        status: {
          in: ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
        },
      },
    },
  });

  const row = rows.find((item) => getCandidateDestinations(item.address, tokenContract).includes(toAddress));
  if (!row) {
    return;
  }

  await applyPaymentTransition({
    orderId: row.orderId,
    txHash,
    tokenContract,
    toAddress,
    rawAmount,
    blockNumber: slot,
    confirmations,
  });
}

async function refreshConfirmations(currentFinalizedSlot: number) {
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
    const confirmations = Math.max(0, currentFinalizedSlot - Number(payment.blockNumber) + 1);
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

async function scanOneTarget(orderPaymentAddress: {
  orderId: string;
  address: string;
  tokenSymbol: string;
  expectedRawAmount: string;
}) {
  const mint = resolveMintBySymbol(orderPaymentAddress.tokenSymbol);
  if (!mint) {
    // eslint-disable-next-line no-console
    console.error('[watcher-sol] unsupported tokenSymbol in orderPaymentAddress', orderPaymentAddress.tokenSymbol);
    return;
  }

  const candidates = getCandidateDestinations(orderPaymentAddress.address, mint);
  const signatureSet = new Set<string>();
  const newestSlotBySignature = new Map<string, number>();

  for (const candidate of candidates) {
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(candidate);
    } catch {
      continue;
    }

    const cursorKey = `${mint.toLowerCase()}:${candidate}`;
    const cursor = await prisma.watcherCursor.findUnique({
      where: {
        chain_tokenContract: {
          chain,
          tokenContract: cursorKey,
        },
      },
    });

    const lastSeenSlot = cursor ? Number(cursor.lastScannedBlock) : 0;
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: signatureLimit }, 'confirmed');
    let maxSeenSlot = lastSeenSlot;

    for (const sig of signatures) {
      if (!sig.err && sig.slot > lastSeenSlot) {
        signatureSet.add(sig.signature);
        newestSlotBySignature.set(sig.signature, sig.slot);
      }
      if (sig.slot > maxSeenSlot) {
        maxSeenSlot = sig.slot;
      }
    }

    if (maxSeenSlot > lastSeenSlot) {
      await prisma.watcherCursor.upsert({
        where: {
          chain_tokenContract: {
            chain,
            tokenContract: cursorKey,
          },
        },
        create: {
          chain,
          tokenContract: cursorKey,
          lastScannedBlock: BigInt(maxSeenSlot),
        },
        update: {
          lastScannedBlock: BigInt(maxSeenSlot),
        },
      });
    }
  }

  if (signatureSet.size === 0) {
    return;
  }

  const currentFinalizedSlot = await connection.getSlot('finalized');
  const signaturesSorted = [...signatureSet].sort(
    (a, b) => (newestSlotBySignature.get(a) || 0) - (newestSlotBySignature.get(b) || 0),
  );

  for (const signature of signaturesSorted) {
    const exists = await prisma.payment.findUnique({ where: { txHash: signature } });
    if (exists && exists.confirmations >= confirmThreshold) {
      continue;
    }

    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx || tx.meta?.err) {
      continue;
    }

    const transfers = extractTransfers(tx);

    const matched = transfers.find((item) =>
      item.rawAmount === orderPaymentAddress.expectedRawAmount
      && item.mint === mint
      && candidates.includes(item.destination),
    );

    if (!matched) {
      continue;
    }

    const confirmations = Math.max(0, currentFinalizedSlot - tx.slot + 1);
    await processTransfer(orderPaymentAddress.tokenSymbol, mint, signature, tx.slot, matched.destination, matched.rawAmount, confirmations);
  }
}

async function loop() {
  while (true) {
    try {
      const targets = await prisma.orderPaymentAddress.findMany({
        where: {
          chain,
          order: {
            status: {
              in: ['PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
            },
          },
        },
        select: {
          orderId: true,
          address: true,
          tokenSymbol: true,
          expectedRawAmount: true,
        },
        take: scanTargetLimit,
      });

      const uniqueTargets = new Map<string, (typeof targets)[number]>();
      for (const target of targets) {
        const key = `${target.address}:${target.tokenSymbol}:${target.expectedRawAmount}`;
        if (!uniqueTargets.has(key)) {
          uniqueTargets.set(key, target);
        }
      }

      for (const target of uniqueTargets.values()) {
        await scanOneTarget(target);
        if (scanDelayMs > 0) {
          await sleep(scanDelayMs);
        }
      }

      const finalizedSlot = await connection.getSlot('finalized');
      await refreshConfirmations(finalizedSlot);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[watcher-sol] scan failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[watcher-sol] fatal', error);
  process.exit(1);
});


