export type ChainGuide = {
  slug: string;
  title: string;
  description: string;
  chain: string;
  productId: string;
  minUnitHint: string;
  faucetHint: string;
};

export const CHAIN_GUIDES: ChainGuide[] = [
  {
    slug: 'sepolia-eth-faucet-alternative',
    title: 'Sepolia ETH Faucet Alternative',
    description:
      'Use official Sepolia faucets first, then buy additional Sepolia ETH test tokens when quota is not enough for CI or repeated deployments.',
    chain: 'Ethereum Sepolia',
    productId: 'sepolia_eth_test',
    minUnitHint: '2 units',
    faucetHint: 'Rotate official faucets and request from verified accounts first.',
  },
  {
    slug: 'solana-testnet-faucet-alternative',
    title: 'Solana Test Token Faucet Alternative',
    description:
      'Follow a faucet-first path for Solana devnet/testnet and buy deficit tokens when faucet throughput or limits block your test workflow.',
    chain: 'Solana Devnet/Testnet',
    productId: 'solana_test',
    minUnitHint: '5 units',
    faucetHint: 'Attempt devnet/testnet faucet requests before paid top-up.',
  },
  {
    slug: 'bsc-testnet-bnb-faucet-alternative',
    title: 'BSC Testnet BNB Faucet Alternative',
    description:
      'Get BSC testnet BNB via faucet first, then use paid delivery when you need predictable supply for contract tests and rehearsals.',
    chain: 'BSC Testnet',
    productId: 'bnb_test',
    minUnitHint: '2 units',
    faucetHint: 'Prefer BNB Chain official faucet channels for initial supply.',
  },
  {
    slug: 'base-sepolia-faucet-alternative',
    title: 'Base Sepolia ETH Faucet Alternative',
    description:
      'Try Base Sepolia faucet channels first; when faucet quota is exhausted, buy exact additional tokens and ship automatically.',
    chain: 'Base Sepolia',
    productId: 'base_sepolia_eth_test',
    minUnitHint: '2 units',
    faucetHint: 'Use ecosystem faucet sources tied to authenticated developer accounts first.',
  },
  {
    slug: 'arbitrum-sepolia-faucet-alternative',
    title: 'Arbitrum Sepolia ETH Faucet Alternative',
    description:
      'Apply faucet-first strategy for Arbitrum Sepolia and buy extra test ETH only when faucet output cannot satisfy your testing volume.',
    chain: 'Arbitrum Sepolia',
    productId: 'arbitrum_sepolia_eth_test',
    minUnitHint: '2 units',
    faucetHint: 'Use official/partner faucet sources before creating paid orders.',
  },
  {
    slug: 'sui-testnet-sui-faucet-alternative',
    title: 'Sui Testnet SUI Faucet Alternative',
    description:
      'Use Sui testnet faucet first, then buy SUI test tokens when faucet rate limits or daily caps block your integration tests.',
    chain: 'Sui Testnet',
    productId: 'sui_testnet_sui',
    minUnitHint: '5 units',
    faucetHint: 'Request from Sui official faucet endpoint first, then top up as needed.',
  },
  {
    slug: 'xlayer-okb-faucet-alternative',
    title: 'X Layer Testnet OKB Faucet Alternative',
    description:
      'Acquire X Layer testnet OKB from available faucet paths first and purchase additional OKB test tokens when needed for stable throughput.',
    chain: 'X Layer Testnet',
    productId: 'xlayer_okb_test',
    minUnitHint: '5 units',
    faucetHint: 'Run faucet attempts before switching to paid dispatch.',
  },
  {
    slug: 'ton-testnet-faucet-alternative',
    title: 'TON Test Token Faucet Alternative',
    description:
      'Use TON faucet resources first, then buy additional TON test tokens if faucet cooldowns slow down development and test automation.',
    chain: 'TON Testnet',
    productId: 'ton_test',
    minUnitHint: '10 units',
    faucetHint: 'Always try official TON faucet pathways prior to purchase.',
  },
];

export function getChainGuideBySlug(slug: string): ChainGuide | null {
  return CHAIN_GUIDES.find((item) => item.slug === slug) ?? null;
}
