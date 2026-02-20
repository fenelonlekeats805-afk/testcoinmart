// Sources (checked 2026-02-12):
// - TON address format and user-friendly form: https://docs.ton.org/foundations/addresses/formats
// - TON wallet transfer flow with @ton/ton: https://docs.ton.org/standard/wallets/highload/v3/send-single-transfer
// - @ton/ton SDK API surface (TonClient/WalletContractV4): package types in node_modules/@ton/ton/dist
// - TON mnemonics and key derivation: https://docs.ton.org/standard/wallets/mnemonics
import { Prisma, PrismaClient } from '@prisma/client';
import { Address, ContractProvider, internal } from '@ton/core';
import { keyPairFromSecretKey, mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';

const prisma = new PrismaClient();
const pollMs = Number(process.env.DISPATCH_TON_POLL_MS || 6000);

type TonDispatchConfig = {
  endpoint: string;
  apiKey?: string;
  unitAmountNano: bigint;
  keyPair: { publicKey: Buffer; secretKey: Buffer };
};

let configCache: { key: string; value: TonDispatchConfig } | null = null;

function normalizeHexSecret(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
}

function parseMnemonicWords(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

async function resolveTonKeyPair(): Promise<{ publicKey: Buffer; secretKey: Buffer }> {
  const mnemonicRaw = process.env.TON_SENDER_MNEMONIC?.trim();
  const secretRaw = process.env.TON_SENDER_SECRET_KEY_HEX?.trim();

  // Source (checked 2026-02-17): TON docs and @ton/crypto show 24-word mnemonic -> keypair via mnemonicToPrivateKey.
  // https://docs.ton.org/standard/wallets/mnemonics
  // https://github.com/ton-org/ton-crypto
  if (mnemonicRaw) {
    const words = parseMnemonicWords(mnemonicRaw);
    if (words.length !== 24) {
      throw new Error('TON_SENDER_MNEMONIC must contain exactly 24 words');
    }
    const valid = await mnemonicValidate(words);
    if (!valid) {
      throw new Error('TON_SENDER_MNEMONIC is invalid');
    }
    const keyPair = await mnemonicToPrivateKey(words);
    return {
      publicKey: Buffer.from(keyPair.publicKey),
      secretKey: Buffer.from(keyPair.secretKey),
    };
  }

  if (!secretRaw) {
    throw new Error('Missing TON sender key (TON_SENDER_SECRET_KEY_HEX or TON_SENDER_MNEMONIC)');
  }

  const normalizedHex = normalizeHexSecret(secretRaw);
  if (/^[0-9a-fA-F]{128}$/.test(normalizedHex)) {
    const secret = Buffer.from(normalizedHex, 'hex');
    const keyPair = keyPairFromSecretKey(secret);
    return {
      publicKey: Buffer.from(keyPair.publicKey),
      secretKey: Buffer.from(keyPair.secretKey),
    };
  }

  // Backward compatibility: if operator put 24-word mnemonic into TON_SENDER_SECRET_KEY_HEX, still accept.
  const words = parseMnemonicWords(secretRaw);
  if (words.length === 24) {
    const valid = await mnemonicValidate(words);
    if (!valid) {
      throw new Error('TON_SENDER_SECRET_KEY_HEX contains mnemonic words but mnemonic is invalid');
    }
    const keyPair = await mnemonicToPrivateKey(words);
    return {
      publicKey: Buffer.from(keyPair.publicKey),
      secretKey: Buffer.from(keyPair.secretKey),
    };
  }

  throw new Error(
    'TON_SENDER_SECRET_KEY_HEX must be 64-byte hex (128 chars, optional 0x) or a 24-word mnemonic',
  );
}

async function loadConfig(): Promise<TonDispatchConfig | null> {
  const endpoint = process.env.TON_RPC_ENDPOINT;
  const amountNanoRaw = process.env.TON_TESTNET_DISPATCH_AMOUNT_NANO;
  const mnemonicRaw = process.env.TON_SENDER_MNEMONIC || '';
  const secretRaw = process.env.TON_SENDER_SECRET_KEY_HEX || '';
  const apiKey = process.env.TON_API_KEY || '';

  if (!endpoint || !amountNanoRaw || (!mnemonicRaw && !secretRaw)) {
    return null;
  }

  const unitAmountNano = BigInt(amountNanoRaw);
  if (unitAmountNano <= 0n) {
    throw new Error('TON_TESTNET_DISPATCH_AMOUNT_NANO must be positive');
  }

  const cacheKey = [endpoint, apiKey, amountNanoRaw, mnemonicRaw, secretRaw].join('|');
  if (configCache && configCache.key === cacheKey) {
    return configCache.value;
  }

  const keyPair = await resolveTonKeyPair();

  const value = {
    endpoint,
    apiKey: apiKey || undefined,
    unitAmountNano,
    keyPair,
  };
  configCache = { key: cacheKey, value };
  return value;
}

async function failManual(orderId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({ where: { orderId } });
    if (!shipment) {
      await tx.shipment.create({
        data: {
          orderId,
          dispatcher: 'dispatcher-ton',
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
        payload: { reason, dispatcher: 'ton' },
      },
    });
  });
}

async function waitSeqnoIncrement(
  walletContract: WalletContractV4,
  provider: ContractProvider,
  previousSeqno: number,
): Promise<void> {
  const timeout = Date.now() + 60_000;
  while (Date.now() < timeout) {
    const current = await walletContract.getSeqno(provider);
    if (current > previousSeqno) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('TON seqno not incremented within timeout');
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
            dispatcher: 'dispatcher-ton',
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

  const cfg = await loadConfig();
  if (!cfg) {
    await failManual(
      order.id,
      'Missing TON dispatcher config (TON_RPC_ENDPOINT/(TON_SENDER_SECRET_KEY_HEX or TON_SENDER_MNEMONIC)/TON_TESTNET_DISPATCH_AMOUNT_NANO)',
    );
    return;
  }

  let recipient: Address;
  try {
    recipient = Address.parse(order.fulfillmentAddress);
  } catch {
    await failManual(order.id, 'Invalid TON recipient address');
    return;
  }

  try {
    const client = new TonClient({ endpoint: cfg.endpoint, apiKey: cfg.apiKey });
    const walletContract = WalletContractV4.create({
      workchain: 0,
      publicKey: cfg.keyPair.publicKey,
    });
    const provider = client.provider(walletContract.address);

    const quantity = BigInt(order.quantity);
    if (quantity <= 0n) {
      throw new Error(`Invalid order quantity: ${order.quantity}`);
    }
    const totalAmountNano = cfg.unitAmountNano * quantity;

    const senderAddress = walletContract.address;
    const balance = await client.getBalance(senderAddress);
    if (balance <= totalAmountNano) {
      throw new Error(`Insufficient TON balance for dispatch. balance=${balance} required>${totalAmountNano}`);
    }

    const prevSeqno = await walletContract.getSeqno(provider);

    await walletContract.sendTransfer(provider, {
      seqno: prevSeqno,
      secretKey: cfg.keyPair.secretKey,
      messages: [
        internal({
          to: recipient,
          value: totalAmountNano,
          bounce: false,
        }),
      ],
    });

    await waitSeqnoIncrement(walletContract, provider, prevSeqno);

    const state = await client.getContractState(senderAddress);
    const txHash = state.lastTransaction?.hash || `ton-seqno-${prevSeqno + 1}`;

    await prisma.$transaction(async (txPrisma) => {
      await txPrisma.shipment.update({
        where: { orderId: order.id },
        data: {
          txHash,
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
          eventType: 'DISPATCH_SENT',
          payload: { txHash, dispatcher: 'ton' },
        },
      });

      await txPrisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'FULFILLED',
          payload: { txHash, dispatcher: 'ton' },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown TON dispatch error';
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
            fulfillmentKind: 'TON',
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
      console.error('[dispatcher-ton] loop failed', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

loop().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[dispatcher-ton] fatal', error);
  process.exit(1);
});
