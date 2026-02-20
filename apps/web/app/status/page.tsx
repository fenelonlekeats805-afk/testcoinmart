'use client';

import { useState } from 'react';
import { API_BASE } from '../../lib/api';
import { absoluteUrl, BRAND_NAME } from '../../lib/site';

export default function StatusPage() {
  const [orderId, setOrderId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const pageUrl = absoluteUrl('/status');
  const logoUrl = absoluteUrl('/logos/logo.png');
  const statusSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        '@id': absoluteUrl('/status#howto'),
        name: 'Check order status on TestCoin Mart',
        description: 'Lookup an order and read fulfillment state transitions.',
        inLanguage: 'en',
        image: logoUrl,
        totalTime: 'PT1M',
        tool: [
          {
            '@type': 'HowToTool',
            name: 'Order ID',
          },
        ],
        supply: [
          {
            '@type': 'HowToSupply',
            name: 'Order ID returned by API',
          },
        ],
        mainEntityOfPage: pageUrl,
        step: [
          {
            '@type': 'HowToStep',
            name: 'Open status page',
            text: 'Go to the order status page and prepare the order ID.',
            url: absoluteUrl('/status#step-1'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Enter order ID',
            text: 'Paste the exact order ID returned by POST /v1/orders.',
            url: absoluteUrl('/status#step-2'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Read terminal state',
            text: 'Track result until FULFILLED, FULFILL_FAILED_MANUAL, or EXPIRED.',
            url: absoluteUrl('/status#step-3'),
            image: logoUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': absoluteUrl('/status#faq'),
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Which statuses are terminal?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'FULFILLED, FULFILL_FAILED_MANUAL, and EXPIRED are terminal states in V1.',
            },
          },
          {
            '@type': 'Question',
            name: 'What if status is EXTRA_PAYMENT?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EXTRA_PAYMENT requires manual support handling and will not auto-dispatch.',
            },
          },
          {
            '@type': 'Question',
            name: `Can ${BRAND_NAME} dispatch before confirmations?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. Dispatch starts only after chain confirmation threshold is met.',
            },
          },
        ],
      },
    ],
  };

  async function query() {
    setError('');
    setResult(null);

    if (!orderId.trim()) {
      setError('Please enter an order ID');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    }
  }

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(statusSchema) }}
      />
      <div className="panel" style={{ padding: 18 }}>
        <h2>Order Status Lookup</h2>
        <div className="field">
          <label>Order ID</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. cmlkubiuq0001ifwst5s747xm"
          />
        </div>
        <button className="btn btn-primary" onClick={query}>
          Search
        </button>
        {error && <p className="warn">{error}</p>}
        {result && (
          <pre
            style={{
              overflow: 'auto',
              background: '#111',
              color: '#eee',
              padding: 12,
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
