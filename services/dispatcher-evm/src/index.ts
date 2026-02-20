// Research sources: docs/research/*.md (official links and parameter validation)
import { Prisma, PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();
const pollMs = Number(process.env.DISPATCH_EVM_POLL_MS || 5000);

type EvmDispatchConfig = {
  rpcUrl: string;
  privateKey: string;
  unitAmountWei: bigint;
};

function getConfigForProduct(productId: string): EvmDispatchConfig | null {
  const map: Record<string, { rpcEnv: string; keyEnv: string; amountEnv: string }> = {
    sepolia_eth_test: {
      rpcEnv: 'DISPATCH_SEPOLIA_RPC_URL',
      keyEnv: 'DISPATCH_SEPOLIA_PRIVATE_KEY',
      amountEnv: 'DISPATCH_SEPOLIA_AMOUNT_WEI',
    },
    base_sepolia_eth_test: {
      rpcEnv: 'DISPATCH_BASE_SEPOLIA_RPC_URL',
      keyEnv: 'DISPATCH_BASE_SEPOLIA_PRIVATE_KEY',
      amountEnv: 'DISPATCH_BASE_SEPOLIA_AMOUNT_WEI',
    },
    arbitrum_sepolia_eth_test: {
      rpcEnv: 'DISPATCH_ARBITRUM_SEPOLIA_RPC_URL',
      keyEnv: 'DISPATCH_ARBITRUM_SEPOLIA_PRIVATE_KEY',
      amountEnv: 'DISPATCH_ARBITRUM_SEPOLIA_AMOUNT_WEI',
    },
    bnb_test: {
      rpcEnv: 'DISPATCH_BSC_TESTNET_RPC_URL',
      keyEnv: 'DISPATCH_BSC_TESTNET_PRIVATE_KEY',
      amountEnv: 'DISPATCH_BSC_TESTNET_AMOUNT_WEI',
    },
    xlayer_okb_test: {
      rpcEnv: 'DISPATCH_XLAYER_TESTNET_RPC_URL',
      keyEnv: 'DISPATCH_XLAYER_TESTNET_PRIVATE_KEY',
      amountEnv: 'DISPATCH_XLAYER_TESTNET_AMOUNT_WEI',
    },
  };

  const target = map[productId];
  if (!target) {
    return null;
  }

  const rpcUrl = process.env[target.rpcEnv];
  const privateKey = process.env[target.keyEnv];
  const amountWei = process.env[target.amountEnv];

  if (!rpcUrl || !privateKey || !amountWei) {
    return null;
  }

  const unitAmountWei = BigInt(amountWei);
  if (unitAmountWei <= 0n) {
    return null;
  }

  return { rpcUrl, privateKey, unitAmountWei };
}

async function failManual(orderId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    await tx.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        dispatcher: 'dispatcher-evm',
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
        payload: { reason, dispatcher: 'evm' },
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
            dispatcher: 'dispatcher-evm',
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

  const cfg = getConfigForProduct(order.productId);
  if (!cfg) {
    await failManual(order.id, `Missing dispatcher config for ${order.productId}`);
    return;
  }

  try {
    const quantity = BigInt(order.quantity);
    if (quantity <= 0n) {
      throw new Error(`Invalid order quantity: ${order.quantity}`);
    }
    const totalAmountWei = cfg.unitAmountWei * quantity;
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const wallet = new ethers.Wallet(cfg.privateKey, provider);
    const tx = await wallet.sendTransaction({
      to: order.fulfillmentAddress,
      value: totalAmountWei,
    });

    await prisma.$transaction(async (txPrisma) => {
      await txPrisma.shipment.update({
        where: { orderId: order.id },
        data: {
          txHash: tx.hash,
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
          payload: { txHash: tx.hash, dispatcher: 'evm' },
        },
      });
    });

    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Error('EVM transaction receipt indicates failure');
    }

    await prisma.$transaction(async (txPrisma) => {
      await txPrisma.order.update({
        where: { id: order.id },
        data: {
          status: 'FULFILLED',
        },
      });
      await txPrisma.shipment.update({
        where: { orderId: order.id },
        data: {
          status: 'CONFIRMED',
        },
      });
      await txPrisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'FULFILLED',
          payload: { txHash: tx.hash },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown EVM dispatch error';
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
            fulfillmentKind: 'EVM',
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
      console.error('[dispatcher-evm] loop failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[dispatcher-evm] fatal', error);
  process.exit(1);
});


