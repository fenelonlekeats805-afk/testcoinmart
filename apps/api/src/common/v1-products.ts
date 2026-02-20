export const V1_PRODUCT_IDS = [
  'sepolia_eth_test',
  'solana_test',
  'bnb_test',
  'base_sepolia_eth_test',
  'arbitrum_sepolia_eth_test',
  'sui_testnet_sui',
  'xlayer_okb_test',
  'ton_test',
] as const;

export type V1ProductId = (typeof V1_PRODUCT_IDS)[number];
