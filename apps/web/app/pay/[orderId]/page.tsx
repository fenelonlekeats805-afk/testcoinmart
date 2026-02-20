'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE } from '../../../lib/api';
import { absoluteUrl } from '../../../lib/site';

type PaymentOption = {
  chain: string;
  tokenSymbol: string;
  amountDisplay: string;
  expectedRawAmount: string;
  address: string;
};

type OrderResponse = {
  orderId: string;
  status: string;
  quantity: number;
  unitPriceUsd: string;
  totalPriceUsd: string;
  createdAt: string;
  expiresAt: string;
  paymentOptions: PaymentOption[];
};

type StatusTone = 'neutral' | 'progress' | 'success' | 'error';

function getStatusMeta(status?: string): { title: string; desc: string; tone: StatusTone; showMotion: boolean } {
  switch (status) {
    case 'PAYMENT_DETECTED':
      return {
        title: 'Payment Detected',
        desc: 'Transfer detected on-chain. Waiting for confirmation threshold.',
        tone: 'progress',
        showMotion: true,
      };
    case 'PAYMENT_CONFIRMED':
      return {
        title: 'Payment Confirmed',
        desc: 'On-chain confirmation reached. Dispatch queue is processing your order.',
        tone: 'progress',
        showMotion: true,
      };
    case 'DISPATCH_ENQUEUED':
      return {
        title: 'Dispatch Queued',
        desc: 'Your order is queued and will be sent shortly.',
        tone: 'progress',
        showMotion: true,
      };
    case 'DISPATCH_SENT':
      return {
        title: 'Dispatch Sent',
        desc: 'Dispatch transaction is submitted and waiting for final confirmation.',
        tone: 'progress',
        showMotion: true,
      };
    case 'FULFILLED':
      return {
        title: 'Order Fulfilled',
        desc: 'Payment and dispatch are both complete. You can copy tx hashes on status page.',
        tone: 'success',
        showMotion: true,
      };
    case 'FULFILL_FAILED_MANUAL':
      return {
        title: 'Manual Intervention Required',
        desc: 'Dispatch failed and was routed to manual queue. Please contact support.',
        tone: 'error',
        showMotion: false,
      };
    case 'EXPIRED':
      return {
        title: 'Order Expired',
        desc: 'No valid payment was detected in time. This order will not auto-dispatch.',
        tone: 'error',
        showMotion: false,
      };
    case 'EXTRA_PAYMENT':
      return {
        title: 'Extra Payment Detected',
        desc: 'Multiple payments were detected for this order and require manual review.',
        tone: 'error',
        showMotion: false,
      };
    default:
      return {
        title: 'Awaiting Payment',
        desc: 'Pay exact amount to the selected chain address.',
        tone: 'neutral',
        showMotion: false,
      };
  }
}

export default function PayPage() {
  const params = useParams<{ orderId: string }>();
  const [data, setData] = useState<OrderResponse | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState('BSC');
  const [now, setNow] = useState(Date.now());
  const [celebrate, setCelebrate] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  async function loadOrder() {
    try {
      const res = await fetch(`${API_BASE}/orders/${params.orderId}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = await res.json();
      setData(body);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  useEffect(() => {
    loadOrder();
    const t1 = setInterval(loadOrder, 5000);
    const t2 = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [params.orderId]);

  const grouped = useMemo(() => {
    const map: Record<string, PaymentOption[]> = {};
    for (const item of data?.paymentOptions || []) {
      map[item.chain] ||= [];
      map[item.chain].push(item);
    }
    return map;
  }, [data]);

  const left = data ? Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - now) / 1000)) : 0;
  const statusMeta = getStatusMeta(data?.status);
  const paySchema = useMemo(() => {
    const pageUrl = absoluteUrl(`/pay/${params.orderId}`);
    const logoUrl = absoluteUrl('/logos/logo.png');
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'HowTo',
          '@id': absoluteUrl(`/pay/${params.orderId}#howto`),
          name: 'Pay and track order',
          description: 'Pay exact amount and monitor status until terminal state.',
          inLanguage: 'en',
          image: logoUrl,
          totalTime: 'PT5M',
          mainEntityOfPage: pageUrl,
          tool: [
            {
              '@type': 'HowToTool',
              name: 'Wallet with stablecoin support',
            },
          ],
          supply: [
            {
              '@type': 'HowToSupply',
              name: 'Order-specific payment address',
            },
          ],
          step: [
            {
              '@type': 'HowToStep',
              name: 'Choose chain and token',
              text: 'Select BSC, TRON, SOL, or BASE option from payment tabs.',
              url: absoluteUrl(`/pay/${params.orderId}#step-1`),
              image: logoUrl,
            },
            {
              '@type': 'HowToStep',
              name: 'Transfer exact amount',
              text: 'Pay exact amountDisplay to the order-specific address with matching token.',
              url: absoluteUrl(`/pay/${params.orderId}#step-2`),
              image: logoUrl,
            },
            {
              '@type': 'HowToStep',
              name: 'Wait for confirmations',
              text: 'Order moves to dispatch only after confirmation threshold is reached.',
              url: absoluteUrl(`/pay/${params.orderId}#step-3`),
              image: logoUrl,
            },
            {
              '@type': 'HowToStep',
              name: 'Confirm terminal status',
              text: 'Track status until FULFILLED or manual terminal state.',
              url: absoluteUrl(`/pay/${params.orderId}#step-4`),
              image: logoUrl,
            },
          ],
        },
        {
          '@type': 'FAQPage',
          '@id': absoluteUrl(`/pay/${params.orderId}#faq`),
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Can I underpay or overpay?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. Raw amount must match expectedRawAmount exactly.',
              },
            },
            {
              '@type': 'Question',
              name: 'Can I pay twice to speed up?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. Duplicate transfers trigger EXTRA_PAYMENT and manual handling.',
              },
            },
            {
              '@type': 'Question',
              name: 'Will expired orders auto-dispatch if paid later?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. Late payments are recorded for manual handling and not auto-dispatched.',
              },
            },
          ],
        },
      ],
    };
  }, [params.orderId]);

  useEffect(() => {
    if (!data?.status) {
      return;
    }
    if (data.status === 'FULFILLED' && lastStatus !== 'FULFILLED') {
      setCelebrate(true);
      const timer = setTimeout(() => setCelebrate(false), 1800);
      setLastStatus(data.status);
      return () => clearTimeout(timer);
    }
    setLastStatus(data.status);
    return undefined;
  }, [data?.status, lastStatus]);

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(paySchema) }}
      />
      <div className="panel" style={{ padding: 18, marginBottom: 12 }}>
        <h2>Pay Order</h2>
        <p>Order ID: <code>{params.orderId}</code></p>
        {data && <p>Status: <strong>{data.status}</strong></p>}
        {data && <p>Quantity: {data.quantity} | Unit: ${data.unitPriceUsd} | Total: ${data.totalPriceUsd}</p>}
        <p>Time Left: {left}s</p>

        <div className="warn">
          Pay exact amount only. Do not send duplicate payments. Dispatch starts only after confirmation threshold.
        </div>
      </div>

      {data && (
        <div className={`status-hero status-hero--${statusMeta.tone}`} style={{ marginBottom: 12 }}>
          <div className={`status-dot ${statusMeta.showMotion ? 'status-dot--pulse' : ''}`} aria-hidden />
          <div>
            <h3 style={{ margin: 0 }}>{statusMeta.title}</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>{statusMeta.desc}</p>
          </div>
          {celebrate && <div className="status-burst" aria-hidden />}
        </div>
      )}

      <div className="panel" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {['BSC', 'TRON', 'SOL', 'BASE'].map((chain) => (
            <button key={chain} className="btn" onClick={() => setActive(chain)}>
              {chain}
            </button>
          ))}
        </div>

        {(grouped[active] || []).map((item) => (
          <div key={`${item.chain}-${item.tokenSymbol}`} className="panel" style={{ padding: 14, marginBottom: 8 }}>
            <h4 style={{ marginTop: 0 }}>{item.chain} / {item.tokenSymbol}</h4>
            <p>Amount: {item.amountDisplay} {item.tokenSymbol}</p>
            <p>Address: <code>{item.address}</code></p>
            <p>Raw Amount: <code>{item.expectedRawAmount}</code></p>
          </div>
        ))}
      </div>

      {error && <p className="warn">{error}</p>}

      <p>
        <Link className="btn" href={`/status?orderId=${params.orderId}`}>Check Status</Link>
        <Link className="btn" style={{ marginLeft: 10 }} href={`/support?orderId=${params.orderId}`}>Contact Support</Link>
      </p>
    </main>
  );
}
