export const BRAND_NAME = 'TestCoin Mart';
export const BRAND_TAGLINE = 'Buy testnet coins. Ship in minutes.';
export const BRAND_DESCRIPTION =
  'Buy testnet coins with USDT/USDC and receive automated delivery in minutes across major testnets.';

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const SITE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://testcoinmart.top');

export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) {
    return `${SITE_URL}/${path}`;
  }
  return `${SITE_URL}${path}`;
}

