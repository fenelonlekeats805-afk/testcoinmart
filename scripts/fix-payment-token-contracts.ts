import { Chain, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Config = {
  chain: Chain;
  tokenSymbol: string;
  env: string;
};

const configs: Config[] = [
  { chain: 'BSC', tokenSymbol: 'USDT', env: 'BSC_USDT_CONTRACT' },
  { chain: 'BSC', tokenSymbol: 'USDC', env: 'BSC_USDC_CONTRACT' },
  { chain: 'TRON', tokenSymbol: 'USDT', env: 'TRON_USDT_CONTRACT' },
  { chain: 'SOL', tokenSymbol: 'USDT', env: 'SOL_USDT_MINT' },
  { chain: 'SOL', tokenSymbol: 'USDC', env: 'SOL_USDC_MINT' },
  { chain: 'BASE', tokenSymbol: 'USDC', env: 'BASE_USDC_CONTRACT' },
];

function canonicalContract(chain: Chain, raw: string): string {
  const value = raw.trim();
  if (chain === 'BSC' || chain === 'BASE') {
    return value.toLowerCase();
  }
  return value;
}

async function main() {
  for (const item of configs) {
    const raw = process.env[item.env];
    if (!raw) {
      // eslint-disable-next-line no-console
      console.log(`[fix:token-contracts] skip ${item.chain}/${item.tokenSymbol}: missing ${item.env}`);
      continue;
    }

    const expected = canonicalContract(item.chain, raw);
    const where = {
      chain: item.chain,
      tokenSymbol: item.tokenSymbol,
      tokenContract: { not: expected },
    };

    const orderAddressResult = await prisma.orderPaymentAddress.updateMany({
      where,
      data: { tokenContract: expected },
    });

    const poolResult = await prisma.addressPool.updateMany({
      where,
      data: { tokenContract: expected },
    });

    // TRON only has USDT in V1, so we can safely align all TRON payment tokenContract.
    let paymentCount = 0;
    if (item.chain === 'TRON' && item.tokenSymbol === 'USDT') {
      const paymentResult = await prisma.payment.updateMany({
        where: {
          chain: item.chain,
          tokenContract: { not: expected },
        },
        data: { tokenContract: expected },
      });
      paymentCount = paymentResult.count;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[fix:token-contracts] ${item.chain}/${item.tokenSymbol} -> orderPaymentAddress=${orderAddressResult.count}, addressPool=${poolResult.count}, payments=${paymentCount}`,
    );
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
