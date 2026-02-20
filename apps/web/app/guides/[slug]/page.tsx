import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CHAIN_GUIDES, getChainGuideBySlug } from '../../../lib/guide-meta';
import { absoluteUrl, BRAND_NAME } from '../../../lib/site';

type Params = {
  slug: string;
};

export function generateStaticParams(): Params[] {
  return CHAIN_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const guide = getChainGuideBySlug(params.slug);
  if (!guide) {
    return {
      title: 'Guide Not Found',
    };
  }

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: `/guides/${guide.slug}`,
    },
    openGraph: {
      title: `${guide.title} | ${BRAND_NAME}`,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      type: 'article',
    },
  };
}

export default function ChainGuidePage({ params }: { params: Params }) {
  const guide = getChainGuideBySlug(params.slug);
  if (!guide) {
    notFound();
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(`/guides/${guide.slug}`),
    about: [guide.chain, 'faucet-first', 'testnet token'],
  };

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>{guide.title}</h2>
        <p style={{ color: 'var(--muted)' }}>{guide.description}</p>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Faucet-first Sequence</h3>
        <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Try official faucet channels for {guide.chain}.</li>
          <li>Measure token deficit for your current sprint or CI runs.</li>
          <li>Create order only for missing amount.</li>
          <li>
            Pay exact amount from <code>paymentOptions</code> and poll status until complete.
          </li>
        </ol>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Purchase Mapping</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
          Product ID: <code>{guide.productId}</code>
        </p>
        <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
          Current minimum hint: {guide.minUnitHint}
        </p>
        <p style={{ color: 'var(--muted)' }}>{guide.faucetHint}</p>
        <p style={{ marginBottom: 0 }}>
          <Link className="btn btn-primary" href={`/order/${guide.productId}`}>
            Buy {guide.chain} Tokens
          </Link>
        </p>
      </section>

      <section className="panel" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>API Quick Start</h3>
        <pre style={{ overflow: 'auto', background: '#111', color: '#eee', padding: 12, borderRadius: 10 }}>
{`curl https://testcoinmart.top/v1/products
curl -X POST https://testcoinmart.top/v1/orders
curl https://testcoinmart.top/v1/orders/<order_id>`}
        </pre>
      </section>
    </main>
  );
}
