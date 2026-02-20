import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts, type Product } from '../lib/api';
import { CHAIN_GUIDES } from '../lib/guide-meta';
import { getProductMeta } from '../lib/product-meta';
import { absoluteUrl, BRAND_DESCRIPTION, BRAND_NAME } from '../lib/site';

const PRODUCT_ORDER = [
  'sepolia_eth_test',
  'solana_test',
  'bnb_test',
  'base_sepolia_eth_test',
  'arbitrum_sepolia_eth_test',
  'sui_testnet_sui',
  'xlayer_okb_test',
  'ton_test',
] as const;

export const metadata: Metadata = {
  title: 'Buy Testnet Coins',
  description: BRAND_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
};

function sortProducts(products: Product[]): Product[] {
  const orderMap = new Map<string, number>(PRODUCT_ORDER.map((productId, index) => [productId, index]));
  return [...products].sort((a, b) => {
    const aOrder = orderMap.get(a.productId) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.get(b.productId) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder === bOrder) {
      return a.productId.localeCompare(b.productId);
    }
    return aOrder - bOrder;
  });
}

function buildHomeSchema(products: Product[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': absoluteUrl('/#product-list'),
        name: `${BRAND_NAME} Products`,
        itemListElement: products.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          url: absoluteUrl(`/order/${item.productId}`),
        })),
      },
      ...products.map((item) => ({
        '@type': 'Product',
        '@id': absoluteUrl(`/order/${item.productId}#product`),
        name: item.name,
        sku: item.productId,
        brand: {
          '@id': absoluteUrl('/#organization'),
        },
        category: 'Testnet token',
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: item.priceUsd,
          availability: item.enabled ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: absoluteUrl(`/order/${item.productId}`),
        },
      })),
    ],
  };
}

export default async function HomePage() {
  let products: Product[] = [];
  let error = '';

  try {
    products = sortProducts(await getProducts());
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load products';
  }

  const homeSchema = buildHomeSchema(products);


  return (
    <main className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeSchema) }} />
      <header className="panel" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Available Products</h2>
        <p style={{ color: 'var(--muted)' }}>
          Buy testnet coins with USDT/USDC. No login required. Automatic dispatch starts after exact payment and confirmation threshold.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href="/guides/faucet-first">Faucet-first Guide</Link>
          <Link className="btn" href="/skills">Skills Guide</Link>
          <Link className="btn" href="/support">Contact Support</Link>
        </div>
      </header>

      <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Faucet Alternative Guides</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {CHAIN_GUIDES.map((guide) => (
            <Link key={guide.slug} href={`/guides/${guide.slug}`}>
              {guide.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid">
        {error ? (
          <article className="panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Unable to load products</h3>
            <p className="warn">{error}</p>
            <p style={{ color: 'var(--muted)' }}>
              If this persists, the API may be restarting. Refresh the page in a few seconds.
            </p>
          </article>
        ) : null}
        {products.map((item) => {
          const meta = getProductMeta(item.productId);
          return (
            <article key={item.productId} className="panel" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {meta ? (
                  <img
                    className="token-logo"
                    src={meta.logoSrc}
                    alt={meta.logoAlt}
                    width={28}
                    height={28}
                  />
                ) : null}
                <div>
                  <h3 style={{ margin: 0 }}>{item.name}</h3>
                  {meta ? <small style={{ color: 'var(--muted)' }}>{meta.chainLabel}</small> : null}
                </div>
              </div>
              <p><span className="badge">${item.priceUsd} / unit</span></p>
              <p style={{ color: 'var(--muted)' }}>
                Min qty {item.minPurchaseQty}, step {item.quantityStep}
              </p>
              <p style={{ color: 'var(--muted)' }}>ID: {item.productId}</p>
              <Link className="btn btn-primary" href={`/order/${item.productId}`}>Buy</Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
