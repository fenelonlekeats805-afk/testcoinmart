import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PoolConfig = {
  chain: 'BSC' | 'TRON' | 'SOL' | 'BASE';
  tokenSymbol: string;
  contractEnv: string;
  addressesEnv: string;
  fallbackAddresses: string[];
};

const poolConfigs: PoolConfig[] = [
  {
    chain: 'BSC',
    tokenSymbol: 'USDT',
    contractEnv: 'BSC_USDT_CONTRACT',
    addressesEnv: 'PAYIN_POOL_BSC_USDT_ADDRESSES',
    fallbackAddresses: ['0x1111111111111111111111111111111111111111', '0x1111111111111111111111111111111111111112'],
  },
  {
    chain: 'BSC',
    tokenSymbol: 'USDC',
    contractEnv: 'BSC_USDC_CONTRACT',
    addressesEnv: 'PAYIN_POOL_BSC_USDC_ADDRESSES',
    fallbackAddresses: ['0x1111111111111111111111111111111111111121', '0x1111111111111111111111111111111111111122'],
  },
  {
    chain: 'TRON',
    tokenSymbol: 'USDT',
    contractEnv: 'TRON_USDT_CONTRACT',
    addressesEnv: 'PAYIN_POOL_TRON_USDT_ADDRESSES',
    fallbackAddresses: ['TQvV2JxYQj6R8q9db4QxS9S6V2ykt6Cj8v', 'TQvV2JxYQj6R8q9db4QxS9S6V2ykt6Cj8w'],
  },
  {
    chain: 'SOL',
    tokenSymbol: 'USDT',
    contractEnv: 'SOL_USDT_MINT',
    addressesEnv: 'PAYIN_POOL_SOL_USDT_ADDRESSES',
    fallbackAddresses: ['So11111111111111111111111111111111111111112', '9xQeWvG816bUx9EPf4py8R4vVwBEmc6k9RdtqvYXvy8'],
  },
  {
    chain: 'SOL',
    tokenSymbol: 'USDC',
    contractEnv: 'SOL_USDC_MINT',
    addressesEnv: 'PAYIN_POOL_SOL_USDC_ADDRESSES',
    fallbackAddresses: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
  },
  {
    chain: 'BASE',
    tokenSymbol: 'USDC',
    contractEnv: 'BASE_USDC_CONTRACT',
    addressesEnv: 'PAYIN_POOL_BASE_USDC_ADDRESSES',
    fallbackAddresses: ['0x1111111111111111111111111111111111111131', '0x1111111111111111111111111111111111111132'],
  },
];

function parseAddressList(raw: string | undefined, fallback: string[]): string[] {
  const source = raw && raw.trim().length > 0 ? raw : fallback.join(',');
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidAddressForChain(chain: PoolConfig['chain'], address: string): boolean {
  if (chain === 'BSC' || chain === 'BASE') {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  if (chain === 'TRON') {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  }
  if (chain === 'SOL') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  return false;
}

async function main() {
  for (const pool of poolConfigs) {
    const tokenContract = process.env[pool.contractEnv];
    if (!tokenContract) {
      // eslint-disable-next-line no-console
      console.log(`[seed:address-pool] skip ${pool.chain}/${pool.tokenSymbol} because ${pool.contractEnv} is empty`);
      continue;
    }

    const addresses = parseAddressList(process.env[pool.addressesEnv], pool.fallbackAddresses);
    if (addresses.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[seed:address-pool] skip ${pool.chain}/${pool.tokenSymbol} because ${pool.addressesEnv} is empty`);
      continue;
    }

    for (const address of addresses) {
      if (!isValidAddressForChain(pool.chain, address)) {
        throw new Error(`[seed:address-pool] invalid ${pool.chain} address in ${pool.addressesEnv}: ${address}`);
      }

      const normalizedTokenContract = (pool.chain === 'BSC' || pool.chain === 'BASE')
        ? tokenContract.toLowerCase()
        : tokenContract;

      await prisma.addressPool.upsert({
        where: { address },
        update: {
          chain: pool.chain,
          tokenSymbol: pool.tokenSymbol,
          tokenContract: normalizedTokenContract,
          inUse: false,
        },
        create: {
          chain: pool.chain,
          tokenSymbol: pool.tokenSymbol,
          tokenContract: normalizedTokenContract,
          address,
          inUse: false,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('[seed:address-pool] done');
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
