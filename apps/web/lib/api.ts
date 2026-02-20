const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://testcoinmart.top/v1';
const SERVER_API_BASE = process.env.SERVER_API_BASE || 'http://127.0.0.1:3001/v1';

function resolveApiBase() {
  if (typeof window !== 'undefined') {
    return PUBLIC_API_BASE;
  }
  if (PUBLIC_API_BASE.startsWith('/')) {
    return SERVER_API_BASE;
  }
  return PUBLIC_API_BASE;
}

export const API_BASE = resolveApiBase();

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type Product = {
  productId: string;
  name: string;
  priceUsd: string;
  minPurchaseQty: number;
  quantityStep: number;
  enabled: boolean;
  fulfillmentKind: string;
  requiresSolCluster: boolean;
};

export async function getProducts() {
  return fetchJson<Product[]>('/products');
}

export async function getOrder(orderId: string) {
  return fetchJson(`/orders/${orderId}`);
}
