// Sources (checked 2026-02-12):
// - Sui TypeScript SDK client/tx APIs: https://sdk.mystenlabs.com/typescript/sui-client
// - Coin operations (`splitCoins`, transfer): https://sdk.mystenlabs.com/typescript/transaction-building/basics
// - Coin model and splitting: https://docs.sui.io/guides/developer/sui-101/coin-mgt
// - Network endpoint selection: https://sdk.mystenlabs.com/typedoc/functions/_mysten_sui.client.getFullnodeUrl.html
import { Prisma, PrismaClient } from '@prisma/client';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';

const prisma = new PrismaClient();
const pollMs = Number(process.env.DISPATCH_SUI_POLL_MS || 5000);
const coinTypeSui = '0x2::sui::SUI';

type SuiDispatchConfig = {
  rpcUrl: string;
  gasBudget: bigint;
  unitAmountMist: bigint;
  signer: Ed25519Keypair;
};

function loadConfig(): SuiDispatchConfig | null {
  const key = process.env.SUI_SENDER_KEY;
  const amountRaw = process.env.SUI_TESTNET_DISPATCH_AMOUNT_MIST;
  const gasBudgetRaw = process.env.SUI_GAS_BUDGET;
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');

  if (!key || !amountRaw || !gasBudgetRaw) {
    return null;
  }

  const unitAmountMist = BigInt(amountRaw);
  const gasBudget = BigInt(gasBudgetRaw);

  if (unitAmountMist <= 0n || gasBudget <= 0n) {
    return null;
  }

  const parsed = decodeSuiPrivateKey(key);
  if (parsed.scheme !== 'ED25519') {
    throw new Error(`Unsupported Sui key scheme: ${parsed.scheme}`);
  }

  const signer = Ed25519Keypair.fromSecretKey(parsed.secretKey);
  return { rpcUrl, gasBudget, unitAmountMist, signer };
}

async function failManual(orderId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({ where: { orderId } });
    if (!shipment) {
      await tx.shipment.create({
        data: {
          orderId,
          dispatcher: 'dispatcher-sui',
          status: 'FAILED_MANUAL',
        },
      });
    } else {
      await tx.shipment.update({
        where: { orderId },
        data: { status: 'FAILED_MANUAL' },
      });
    }

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
        payload: {
          dispatcher: 'sui',
          reason,
        },
      },
    });
  });
}

async function ensureBalance(client: SuiClient, owner: string, amountMist: bigint, gasBudget: bigint) {
  let cursor: string | null | undefined = null;
  let total = 0n;

  do {
    const page = await client.getCoins({
      owner,
      coinType: coinTypeSui,
      cursor,
      limit: 50,
    });

    for (const coin of page.data) {
      total += BigInt(coin.balance);
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  if (total < amountMist + gasBudget) {
    throw new Error(`Insufficient SUI balance for dispatch. required=${amountMist + gasBudget}, total=${total}`);
  }
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
            dispatcher: 'dispatcher-sui',
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

  const cfg = loadConfig();
  if (!cfg) {
    await failManual(order.id, 'Missing Sui dispatcher config (SUI_SENDER_KEY/SUI_TESTNET_DISPATCH_AMOUNT_MIST/SUI_GAS_BUDGET)');
    return;
  }

  const delivery = (order.deliveryInfo || {}) as Record<string, unknown>;
  const recipient = typeof delivery.address === 'string' ? delivery.address : order.fulfillmentAddress;

  // Source: https://sdk.mystenlabs.com/typescript/utils (isValidSuiAddress), checked 2026-02-12.
  if (!isValidSuiAddress(recipient)) {
    await failManual(order.id, 'Invalid Sui recipient address');
    return;
  }

  const client = new SuiClient({ url: cfg.rpcUrl });

  try {
    const quantity = BigInt(order.quantity);
    if (quantity <= 0n) {
      throw new Error(`Invalid order quantity: ${order.quantity}`);
    }
    const totalAmountMist = cfg.unitAmountMist * quantity;

    const sender = cfg.signer.toSuiAddress();
    await ensureBalance(client, sender, totalAmountMist, cfg.gasBudget);

    const tx = new Transaction();
    tx.setSender(sender);
    tx.setGasBudget(cfg.gasBudget);

    // Source: https://sdk.mystenlabs.com/typescript/transaction-building/basics, checked 2026-02-12.
    // Sui uses object-based coins, so we split from gas coin and transfer the resulting coin object.
    const [paymentCoin] = tx.splitCoins(tx.gas, [totalAmountMist]);
    tx.transferObjects([paymentCoin], recipient);

    const execution = await client.signAndExecuteTransaction({
      signer: cfg.signer,
      transaction: tx,
      options: { showEffects: true },
      requestType: 'WaitForLocalExecution',
    });

    const digest = execution.digest;

    await prisma.$transaction(async (txPrisma) => {
      await txPrisma.shipment.update({
        where: { orderId: order.id },
        data: {
          txHash: digest,
          status: 'SENT',
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
          payload: { txHash: digest, dispatcher: 'sui' },
        },
      });
    });

    const finalized = await client.waitForTransaction({
      digest,
      options: { showEffects: true },
      timeout: 60_000,
      pollInterval: 2_000,
    });

    const txStatus = finalized.effects?.status?.status;
    if (txStatus !== 'success') {
      throw new Error(`Sui transaction execution status is ${txStatus || 'unknown'}`);
    }

    await prisma.$transaction(async (txPrisma) => {
      await txPrisma.shipment.update({
        where: { orderId: order.id },
        data: {
          status: 'CONFIRMED',
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
          payload: { txHash: digest, dispatcher: 'sui' },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Sui dispatch error';
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
            fulfillmentKind: 'SUI_NATIVE',
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
      console.error('[dispatcher-sui] loop failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[dispatcher-sui] fatal', error);
  process.exit(1);
});
