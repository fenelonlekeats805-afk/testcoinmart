// Research sources: docs/research/*.md (official links and parameter validation)
import { Prisma, PrismaClient } from '@prisma/client';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

const prisma = new PrismaClient();
const pollMs = Number(process.env.DISPATCH_SOLANA_POLL_MS || 7000);

function getConfig(cluster: 'devnet' | 'testnet') {
  const url = cluster === 'devnet' ? process.env.DISPATCH_SOLANA_DEVNET_RPC_URL : process.env.DISPATCH_SOLANA_TESTNET_RPC_URL;
  const secret = cluster === 'devnet' ? process.env.DISPATCH_SOLANA_DEVNET_SECRET_KEY : process.env.DISPATCH_SOLANA_TESTNET_SECRET_KEY;
  const lamportsRaw = cluster === 'devnet'
    ? process.env.DISPATCH_SOLANA_DEVNET_LAMPORTS
    : process.env.DISPATCH_SOLANA_TESTNET_LAMPORTS;

  if (!url || !secret || !lamportsRaw) {
    return null;
  }

  const unitLamports = BigInt(lamportsRaw);
  if (unitLamports <= 0n) {
    return null;
  }

  return {
    url,
    secret,
    unitLamports,
  };
}

async function failManual(orderId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    await tx.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        dispatcher: 'dispatcher-solana',
        status: 'FAILED_MANUAL',
      },
      update: {
        status: 'FAILED_MANUAL',
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'FULFILL_FAILED_MANUAL',
        failReason: reason,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: 'DISPATCH_FAILED_MANUAL',
        payload: { reason, dispatcher: 'solana' },
      },
    });
  });
}

async function processOrder(orderId: string) {
  const order = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const current = await tx.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
      if (!current) {
        return null;
      }
      if (current.status !== 'PAYMENT_CONFIRMED' && current.status !== 'DISPATCH_ENQUEUED') {
        return null;
      }
      if (current.shipment?.txHash) {
        return null;
      }

      if (!current.shipment) {
        await tx.shipment.create({
          data: {
            orderId,
            dispatcher: 'dispatcher-solana',
            status: 'LOCKED',
          },
        });
      }
      if (current.status === 'PAYMENT_CONFIRMED') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'DISPATCH_ENQUEUED' },
        });
      }
      return current;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!order) {
    return;
  }

  const cluster = order.solCluster || 'devnet';
  const cfg = getConfig(cluster);
  if (!cfg) {
    await failManual(order.id, `Missing Solana dispatcher config for ${cluster}`);
    return;
  }

  try {
    const connection = new Connection(cfg.url, 'confirmed');
    const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cfg.secret)));
    const destination = new PublicKey(order.fulfillmentAddress);

    const quantity = BigInt(order.quantity);
    if (quantity <= 0n) {
      throw new Error(`Invalid order quantity: ${order.quantity}`);
    }
    const totalLamports = cfg.unitLamports * quantity;
    if (totalLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Total lamports exceeds Number.MAX_SAFE_INTEGER: ${totalLamports.toString()}`);
    }
    const lamports = Number(totalLamports);
    if (!Number.isFinite(lamports) || lamports <= 0) {
      throw new Error(`Invalid lamports amount: ${lamports}`);
    }
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: destination,
        lamports,
      }),
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: 'confirmed',
    });

    await prisma.$transaction(async (txPrisma) => {
      await txPrisma.shipment.update({
        where: { orderId: order.id },
        data: {
          txHash: signature,
          status: 'CONFIRMED',
        },
      });

      await txPrisma.order.update({
        where: { id: order.id },
        data: {
          status: 'DISPATCH_SENT',
        },
      });

      await txPrisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'DISPATCH_SENT',
          payload: { txHash: signature, dispatcher: 'solana' },
        },
      });

      await txPrisma.order.update({
        where: { id: order.id },
        data: {
          status: 'FULFILLED',
        },
      });

      await txPrisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'FULFILLED',
          payload: { txHash: signature, dispatcher: 'solana' },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Solana dispatch error';
    await failManual(order.id, message);
  }
}

async function loop() {
  while (true) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          status: {
            in: ['PAYMENT_CONFIRMED', 'DISPATCH_ENQUEUED'],
          },
          product: {
            fulfillmentKind: 'SOLANA',
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 30,
      });

      for (const order of orders) {
        await processOrder(order.id);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[dispatcher-solana] loop failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[dispatcher-solana] fatal', error);
  process.exit(1);
});



