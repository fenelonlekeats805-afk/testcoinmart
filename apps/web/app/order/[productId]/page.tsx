'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE } from '../../../lib/api';
import { getProductMeta } from '../../../lib/product-meta';
import { absoluteUrl } from '../../../lib/site';

type Product = {
  productId: string;
  name: string;
  priceUsd: string;
  minPurchaseQty: number;
  quantityStep: number;
  requiresSolCluster: boolean;
};

export default function OrderCreatePage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [solCluster, setSolCluster] = useState<'devnet' | 'testnet'>('devnet');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const isSolanaSku = params.productId === 'solana_test';

  useEffect(() => {
    let alive = true;

    async function loadProduct() {
      try {
        const res = await fetch(`${API_BASE}/products`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const products = await res.json() as Product[];
        if (!alive) {
          return;
        }
        const current = products.find((item) => item.productId === params.productId) || null;
        setProduct(current);
        if (current) {
          setQuantity(current.minPurchaseQty);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Failed to load product');
        }
      }
    }

    loadProduct();
    return () => {
      alive = false;
    };
  }, [params.productId]);

  const totalPriceDisplay = useMemo(() => {
    if (!product) {
      return '--';
    }
    const unit = Number(product.priceUsd);
    if (!Number.isFinite(unit)) {
      return '--';
    }
    return (unit * quantity).toFixed(8).replace(/\.?0+$/, '');
  }, [product, quantity]);
  const productMeta = useMemo(() => getProductMeta(params.productId), [params.productId]);
  const orderSchema = useMemo(() => {
    const productName = product?.name || params.productId;
    const pageUrl = absoluteUrl(`/order/${params.productId}`);
    const logoUrl = absoluteUrl('/logos/logo.png');
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'HowTo',
          '@id': absoluteUrl(`/order/${params.productId}#howto`),
          name: `Create order for ${productName}`,
          description: 'Create an order and submit delivery details before payment.',
          inLanguage: 'en',
          image: logoUrl,
          totalTime: 'PT2M',
          mainEntityOfPage: pageUrl,
          tool: [
            {
              '@type': 'HowToTool',
              name: 'Browser or API client',
            },
          ],
          supply: [
            {
              '@type': 'HowToSupply',
              name: 'Destination address for selected testnet',
            },
          ],
          step: [
            {
              '@type': 'HowToStep',
              name: 'Set quantity',
              text: 'Choose quantity that meets product minimum and step constraints.',
              url: absoluteUrl(`/order/${params.productId}#step-1`),
              image: logoUrl,
            },
            {
              '@type': 'HowToStep',
              name: 'Provide fulfillment address',
              text: 'Enter a valid destination address for the selected product network.',
              url: absoluteUrl(`/order/${params.productId}#step-2`),
              image: logoUrl,
            },
            {
              '@type': 'HowToStep',
              name: 'Submit order',
              text: 'Submit and continue to payment page for exact amount and address details.',
              url: absoluteUrl(`/order/${params.productId}#step-3`),
              image: logoUrl,
            },
          ],
        },
        {
          '@type': 'FAQPage',
          '@id': absoluteUrl(`/order/${params.productId}#faq`),
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Can I buy any quantity?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Quantity must satisfy each product minPurchaseQty and quantityStep validation.',
              },
            },
            {
              '@type': 'Question',
              name: 'Does Solana order need cluster selection?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Solana orders require solCluster set to devnet or testnet.',
              },
            },
            {
              '@type': 'Question',
              name: 'When does fulfillment start?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Fulfillment starts after exact on-chain payment and confirmation threshold are both satisfied.',
              },
            },
          ],
        },
      ],
    };
  }, [params.productId, product?.name]);

  async function submitOrder() {
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: params.productId,
          quantity,
          fulfillmentAddress: address,
          solCluster: isSolanaSku ? solCluster : undefined,
          contact: contact || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${response.status}`);
      }
      const body = await response.json();
      router.push(`/pay/${body.orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create order failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orderSchema) }}
      />
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {productMeta ? (
            <img
              className="token-logo"
              src={productMeta.logoSrc}
              alt={productMeta.logoAlt}
              width={28}
              height={28}
            />
          ) : null}
          <h2 style={{ margin: 0 }}>Create Order</h2>
        </div>
        <p style={{ color: 'var(--muted)' }}>Product ID: {params.productId}</p>
        {productMeta && <p style={{ color: 'var(--muted)' }}>Network: {productMeta.chainLabel}</p>}
        {product && (
          <p style={{ color: 'var(--muted)' }}>
            Unit Price: ${product.priceUsd} | Min Qty: {product.minPurchaseQty} | Step: {product.quantityStep}
          </p>
        )}

        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            min={product?.minPurchaseQty || 1}
            step={product?.quantityStep || 1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <small style={{ color: 'var(--muted)' }}>Estimated total: ${totalPriceDisplay}</small>
        </div>

        <div className="field">
          <label>Fulfillment Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Input delivery address for this SKU" />
        </div>

        {isSolanaSku && (
          <div className="field">
            <label>Solana Cluster</label>
            <select value={solCluster} onChange={(e) => setSolCluster(e.target.value as 'devnet' | 'testnet')}>
              <option value="devnet">Devnet</option>
              <option value="testnet">Testnet</option>
            </select>
          </div>
        )}

        <div className="field">
          <label>Contact (optional)</label>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email or telegram" />
        </div>

        {error && <p className="warn">{error}</p>}

        <button className="btn btn-primary" disabled={submitting} onClick={submitOrder}>
          {submitting ? 'Submitting...' : 'Submit Order'}
        </button>
        <span style={{ marginLeft: 12 }}>
          <Link href="/">Back to Products</Link>
        </span>
      </div>
    </main>
  );
}
