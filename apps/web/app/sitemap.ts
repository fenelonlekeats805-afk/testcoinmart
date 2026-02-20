import type { MetadataRoute } from 'next';
import { CHAIN_GUIDES } from '../lib/guide-meta';
import { SITE_URL } from '../lib/site';

const PRODUCT_IDS = [
  'sepolia_eth_test',
  'solana_test',
  'bnb_test',
  'base_sepolia_eth_test',
  'arbitrum_sepolia_eth_test',
  'sui_testnet_sui',
  'xlayer_okb_test',
  'ton_test',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/skills`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/guides/faucet-first`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/status`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  const productPages: MetadataRoute.Sitemap = PRODUCT_IDS.map((productId) => ({
    url: `${SITE_URL}/order/${productId}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const guidePages: MetadataRoute.Sitemap = CHAIN_GUIDES.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));

  return [...staticPages, ...productPages, ...guidePages];
}
