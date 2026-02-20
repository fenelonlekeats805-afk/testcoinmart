import Link from 'next/link';
import type { Metadata } from 'next';
import { absoluteUrl, BRAND_DESCRIPTION, BRAND_NAME } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Skills Guide',
  description:
    'Learn how agents and scripts use the TestCoin Mart public API and skills endpoints to acquire testnet coins.',
  alternates: {
    canonical: '/skills',
  },
};

export default function SkillsPage() {
  const pageUrl = absoluteUrl('/skills');
  const orgId = absoluteUrl('/#organization');
  const orgUrl = absoluteUrl('/');
  const publishedAt = '2026-02-19T00:00:00Z';
  const modifiedAt = '2026-02-19T00:00:00Z';
  const logoUrl = absoluteUrl('/logos/logo.png');
  const skillsSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': absoluteUrl('/skills#article'),
        headline: `${BRAND_NAME} Skills Usage Guide`,
        description: BRAND_DESCRIPTION,
        inLanguage: 'en',
        image: logoUrl,
        mainEntityOfPage: pageUrl,
        url: pageUrl,
        datePublished: publishedAt,
        dateModified: modifiedAt,
        author: {
          '@type': 'Organization',
          '@id': orgId,
          name: BRAND_NAME,
          url: orgUrl,
        },
        publisher: {
          '@id': orgId,
          '@type': 'Organization',
          name: BRAND_NAME,
          url: orgUrl,
        },
        about: ['API integration', 'Agent automation', 'Testnet token purchasing'],
      },
      {
        '@type': 'HowTo',
        '@id': absoluteUrl('/skills#howto'),
        name: 'Buy testnet coins with TestCoin Mart API',
        description: 'A faucet-first purchase workflow for agents and scripts using public API endpoints.',
        inLanguage: 'en',
        image: logoUrl,
        totalTime: 'PT3M',
        supply: [
          {
            '@type': 'HowToSupply',
            name: 'Supported testnet destination address',
          },
        ],
        tool: [
          {
            '@type': 'HowToTool',
            name: 'Wallet with USDT/USDC support',
          },
          {
            '@type': 'HowToTool',
            name: 'HTTP client (curl/script)',
          },
        ],
        step: [
          {
            '@type': 'HowToStep',
            name: 'Fetch skills or products',
            text: 'Read /v1/skills, then load /v1/products and select a productId.',
            url: absoluteUrl('/skills#step-1'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Create order',
            text: 'POST /v1/orders with productId, quantity, and fulfillmentAddress.',
            url: absoluteUrl('/skills#step-2'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Pay exact amount',
            text: 'Use paymentOptions and transfer exact amount to the returned address.',
            url: absoluteUrl('/skills#step-3'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Poll order status',
            text: 'GET /v1/orders/{order_id} every 3-5 seconds until terminal status.',
            url: absoluteUrl('/skills#step-4'),
            image: logoUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': absoluteUrl('/skills#faq'),
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Do I need an account or API key?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. The purchase API is public and unauthenticated in V1.',
            },
          },
          {
            '@type': 'Question',
            name: 'What causes payment mismatch?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Wrong chain, wrong token, wrong destination address, or non-exact raw amount.',
            },
          },
          {
            '@type': 'Question',
            name: 'When does dispatch start?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Dispatch starts only after on-chain payment reaches the configured confirmation threshold.',
            },
          },
        ],
      },
    ],
  };

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(skillsSchema) }}
      />
      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Skills Usage Guide</h2>
        <p style={{ color: 'var(--muted)' }}>
          This page explains how agents and scripts can consume TestCoin Mart skills and purchase APIs.
        </p>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>1. Discover Skills</h3>
        <pre style={{ overflow: 'auto', background: '#111', color: '#eee', padding: 12, borderRadius: 10 }}>
{`curl https://testcoinmart.top/v1/skills`}
        </pre>
        <p style={{ color: 'var(--muted)' }}>
          The default recommended skill is <code>get-test-faucet</code>.
        </p>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>2. Fetch Skill Payload</h3>
        <pre style={{ overflow: 'auto', background: '#111', color: '#eee', padding: 12, borderRadius: 10 }}>
{`# Marketplace default strategy
curl https://testcoinmart.top/v1/skills/get-test-faucet

# Faucet-first strategy (legacy alias)
curl https://testcoinmart.top/v1/skills/faucet-first

# Purchase-only strategy
curl https://testcoinmart.top/v1/skills/buy

# OpenAPI YAML
curl https://testcoinmart.top/v1/skills/openapi.yaml`}
        </pre>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>3. Core Purchase Flow</h3>
        <pre style={{ overflow: 'auto', background: '#111', color: '#eee', padding: 12, borderRadius: 10 }}>
{`# 1) List products
curl https://testcoinmart.top/v1/products

# 2) Create order (example: Sepolia ETH)
curl -X POST https://testcoinmart.top/v1/orders \\
  -H "Content-Type: application/json" \\
  -d "{\"productId\":\"sepolia_eth_test\",\"quantity\":2,\"fulfillmentAddress\":\"0xYourAddress\"}"

# 3) Query order
curl https://testcoinmart.top/v1/orders/<order_id>`}
        </pre>
        <p style={{ color: 'var(--muted)' }}>
          Always pay exact amount from <code>paymentOptions</code>. Do not duplicate payments.
        </p>
      </section>

      <section className="panel" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Reference Links</h3>
        <p><Link href="/status">Order Status Page</Link></p>
        <p><Link href="/support">Support Ticket Page</Link></p>
      </section>
    </main>
  );
}
