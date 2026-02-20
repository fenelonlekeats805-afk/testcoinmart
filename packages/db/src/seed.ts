import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    id: 'xlayer_okb_test',
    name: 'X Layer Testnet OKB',
    priceUsd: '0.20',
    minPurchaseQty: 5,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'EVM',
    requiresSolCluster: false,
  },
  {
    id: 'sui_testnet_sui',
    name: 'Sui Testnet SUI',
    priceUsd: '0.20',
    minPurchaseQty: 5,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'SUI_NATIVE',
    requiresSolCluster: false,
  },
  {
    id: 'sepolia_eth_test',
    name: 'Sepolia ETH Test Token',
    priceUsd: '0.50',
    minPurchaseQty: 2,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'EVM',
    requiresSolCluster: false,
  },
  {
    id: 'ton_test',
    name: 'TON Test Token',
    priceUsd: '0.10',
    minPurchaseQty: 10,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'TON',
    requiresSolCluster: false,
  },
  {
    id: 'solana_test',
    name: 'Solana Test Token',
    priceUsd: '0.30',
    minPurchaseQty: 5,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'SOLANA',
    requiresSolCluster: true,
  },
  {
    id: 'bnb_test',
    name: 'BSC Testnet BNB',
    priceUsd: '0.50',
    minPurchaseQty: 2,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'EVM',
    requiresSolCluster: false,
  },
  {
    id: 'base_sepolia_eth_test',
    name: 'Base Sepolia ETH',
    priceUsd: '0.50',
    minPurchaseQty: 2,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'EVM',
    requiresSolCluster: false,
  },
  {
    id: 'arbitrum_sepolia_eth_test',
    name: 'Arbitrum Sepolia ETH',
    priceUsd: '0.50',
    minPurchaseQty: 2,
    quantityStep: 1,
    enabled: true,
    fulfillmentKind: 'EVM',
    requiresSolCluster: false,
  },
] as const;

async function main() {
  for (const item of products) {
    await prisma.product.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  // Remove obsolete V1 product if it exists from older deployments.
  await prisma.product.deleteMany({ where: { id: 'btc_signet_sbtc' } });
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
