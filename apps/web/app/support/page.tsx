'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/api';
import { absoluteUrl } from '../../lib/site';

type ContactType = 'telegram' | 'email';

export default function SupportPage() {
  const [payload, setPayload] = useState({
    orderId: '',
    contactType: 'telegram' as ContactType,
    contactValue: '',
    message: '',
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const pageUrl = absoluteUrl('/support');
  const logoUrl = absoluteUrl('/logos/logo.png');
  const supportSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        '@id': absoluteUrl('/support#howto'),
        name: 'Submit a support ticket for an order',
        description: 'Send a support request for failed dispatch, late payment, or extra payment cases.',
        inLanguage: 'en',
        image: logoUrl,
        totalTime: 'PT2M',
        mainEntityOfPage: pageUrl,
        tool: [
          {
            '@type': 'HowToTool',
            name: 'Support form',
          },
        ],
        supply: [
          {
            '@type': 'HowToSupply',
            name: 'Order ID',
          },
          {
            '@type': 'HowToSupply',
            name: 'Contact method',
          },
        ],
        step: [
          {
            '@type': 'HowToStep',
            name: 'Prepare order details',
            text: 'Collect order ID and a reachable contact address.',
            url: absoluteUrl('/support#step-1'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Submit support form',
            text: 'Send orderId, contactType, contactValue, and message.',
            url: absoluteUrl('/support#step-2'),
            image: logoUrl,
          },
          {
            '@type': 'HowToStep',
            name: 'Wait for manual review',
            text: 'Support queue processes failed dispatch and extra payment cases.',
            url: absoluteUrl('/support#step-3'),
            image: logoUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': absoluteUrl('/support#faq'),
        mainEntity: [
          {
            '@type': 'Question',
            name: 'When should I contact support?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Contact support for FULFILL_FAILED_MANUAL, EXTRA_PAYMENT, late payments, or unclear status.',
            },
          },
          {
            '@type': 'Question',
            name: 'What contact methods are accepted?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Telegram or email are both accepted in V1.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does support auto-refund duplicate transfers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. V1 has no automatic refund flow; duplicate transfers are manually handled.',
            },
          },
        ],
      },
    ],
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderIdFromQuery = params.get('orderId');
    if (orderIdFromQuery) {
      setPayload((prev) => ({ ...prev, orderId: orderIdFromQuery }));
    }
  }, []);

  async function submit() {
    setError('');
    setResult(null);

    if (!payload.orderId.trim()) {
      setError('Order ID is required');
      return;
    }
    if (!payload.contactValue.trim()) {
      setError('Contact is required');
      return;
    }
    if (!payload.message.trim()) {
      setError('Message is required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/support_tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    }
  }

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(supportSchema) }}
      />
      <div className="panel" style={{ padding: 18 }}>
        <h2>Contact Support</h2>
        <div className="field">
          <label>Order ID</label>
          <input
            value={payload.orderId}
            onChange={(e) => setPayload({ ...payload, orderId: e.target.value })}
            placeholder="Your order ID"
          />
        </div>

        <div className="field">
          <label>Contact Type</label>
          <select
            value={payload.contactType}
            onChange={(e) => setPayload({ ...payload, contactType: e.target.value as ContactType })}
          >
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="field">
          <label>Contact</label>
          <input
            value={payload.contactValue}
            onChange={(e) => setPayload({ ...payload, contactValue: e.target.value })}
            placeholder="@telegram or your@email.com"
          />
        </div>

        <div className="field">
          <label>Message</label>
          <textarea
            rows={6}
            value={payload.message}
            onChange={(e) => setPayload({ ...payload, message: e.target.value })}
            placeholder="Please describe your issue"
          />
        </div>

        <button className="btn btn-primary" onClick={submit}>
          Submit Ticket
        </button>
        {error && <p className="warn">{error}</p>}
        {result && (
          <p>
            Ticket created: <code>{result.ticketId}</code>
          </p>
        )}
      </div>
    </main>
  );
}
