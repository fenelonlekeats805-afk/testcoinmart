import type { Metadata } from 'next';
import Link from 'next/link';
import { CHAIN_GUIDES } from '../../../lib/guide-meta';
import { absoluteUrl, BRAND_NAME } from '../../../lib/site';

export const metadata: Metadata = {
  title: 'Faucet-first Guide',
  description:
    'A practical faucet-first workflow for developers: try official testnet faucets first, then purchase testnet coins when faucet quota is not enough.',
  alternates: {
    canonical: '/guides/faucet-first',
  },
};

export default function FaucetFirstGuidePage() {
  const guideSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        '@id': absoluteUrl('/guides/faucet-first#howto'),
        name: `${BRAND_NAME} Faucet-first Testnet Coin Guide`,
        step: [
          {
            '@type': 'HowToStep',
            name: 'Check official faucet availability',
            text: 'Use official faucet resources for the target testnet before purchasing.',
          },
          {
            '@type': 'HowToStep',
            name: 'Estimate required token amount',
            text: 'Calculate expected test runs, deployment count, and buffer for retries.',
          },
          {
            '@type': 'HowToStep',
            name: 'Buy only the deficit',
            text: 'If faucet quota is insufficient, create an order and pay exact USDT/USDC amount shown in payment options.',
          },
          {
            '@type': 'HowToStep',
            name: 'Poll status until completion',
            text: 'Check order status every 3-5 seconds until FULFILLED or manual status is returned.',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': absoluteUrl('/guides/faucet-first#faq'),
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Does TestCoin Mart replace official faucets?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. The recommended workflow is faucet-first and purchase only when quota or speed is insufficient.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can agents call this flow automatically?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Agents can read /v1/skills and /skills page, then call /v1/products, /v1/orders, and /v1/orders/{order_id}.',
            },
          },
          {
            '@type': 'Question',
            name: 'What payment rule must be followed?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Payment must match token, destination address, and raw amount exactly, then wait for chain confirmation threshold.',
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema) }}
      />
      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Faucet-first Strategy</h2>
        <p style={{ color: 'var(--muted)' }}>
          Use official faucets first. If your team hits faucet limits or needs predictable throughput,
          use paid delivery for the missing amount only.
        </p>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Recommended Workflow</h3>
        <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)' }}>
          <li>Check faucet status and quota for the target network.</li>
          <li>Estimate required tokens for deployment and test runs.</li>
          <li>Purchase only deficit tokens through the public API.</li>
          <li>Pay exact amount and poll order status until completion.</li>
        </ol>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>API Endpoints</h3>
        <pre style={{ overflow: 'auto', background: '#111', color: '#eee', padding: 12, borderRadius: 10 }}>
{`curl https://testcoinmart.top/v1/skills
curl https://testcoinmart.top/v1/products
curl -X POST https://testcoinmart.top/v1/orders
curl https://testcoinmart.top/v1/orders/<order_id>`}
        </pre>
      </section>

      <section className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Chain-specific Guides</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {CHAIN_GUIDES.map((guide) => (
            <Link key={guide.slug} href={`/guides/${guide.slug}`}>
              {guide.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Important Constraints</h3>
        <p style={{ color: 'var(--muted)' }}>
          One order uses one dedicated payment address per supported chain/token. Exact raw amount match is required.
          Repeated or late payments are recorded for manual handling and not auto-dispatched.
        </p>
      </section>
    </main>
  );
}
