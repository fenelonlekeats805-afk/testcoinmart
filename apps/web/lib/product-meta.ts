export type ProductMeta = {
  chainLabel: string;
  logoSrc: string;
  logoAlt: string;
};

const PRODUCT_META: Record<string, ProductMeta> = {
  xlayer_okb_test: {
    chainLabel: 'X Layer Testnet',
    logoSrc: '/logos/xlayer-okx.png',
    logoAlt: 'X Layer logo',
  },
  sui_testnet_sui: {
    chainLabel: 'Sui Testnet',
    logoSrc: '/logos/sui.svg',
    logoAlt: 'Sui logo',
  },
  sepolia_eth_test: {
    chainLabel: 'Ethereum Sepolia',
    logoSrc: '/logos/ethereum-sepolia.png',
    logoAlt: 'Ethereum logo',
  },
  ton_test: {
    chainLabel: 'TON Testnet',
    logoSrc: '/logos/ton.png',
    logoAlt: 'TON logo',
  },
  solana_test: {
    chainLabel: 'Solana Devnet/Testnet',
    logoSrc: '/logos/solana.svg',
    logoAlt: 'Solana logo',
  },
  bnb_test: {
    chainLabel: 'BSC Testnet',
    logoSrc: '/logos/bnb.svg',
    logoAlt: 'BNB Chain logo',
  },
  base_sepolia_eth_test: {
    chainLabel: 'Base Sepolia',
    logoSrc: '/logos/base.svg',
    logoAlt: 'Base logo',
  },
  arbitrum_sepolia_eth_test: {
    chainLabel: 'Arbitrum Sepolia',
    logoSrc: '/logos/arbitrum.svg',
    logoAlt: 'Arbitrum logo',
  },
};

export function getProductMeta(productId: string): ProductMeta | null {
  return PRODUCT_META[productId] ?? null;
}
