export type Chain = 'BSC' | 'TRON' | 'SOL' | 'BASE';

export type SolCluster = 'devnet' | 'testnet';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_DETECTED'
  | 'PAYMENT_CONFIRMED'
  | 'DISPATCH_ENQUEUED'
  | 'DISPATCH_SENT'
  | 'FULFILLED'
  | 'FULFILL_FAILED_MANUAL'
  | 'EXPIRED'
  | 'EXTRA_PAYMENT';

export type ProductId =
  | 'xlayer_okb_test'
  | 'sui_testnet_sui'
  | 'sepolia_eth_test'
  | 'ton_test'
  | 'solana_test'
  | 'bnb_test'
  | 'base_sepolia_eth_test'
  | 'arbitrum_sepolia_eth_test';

export interface Product {
  productId: ProductId;
  name: string;
  priceUsd: string;
  minPurchaseQty: number;
  quantityStep: number;
  enabled: boolean;
  fulfillmentKind: 'EVM' | 'SOLANA' | 'TON' | 'SUI_NATIVE';
  requiresSolCluster: boolean;
}

export interface CreateOrderRequest {
  productId: ProductId;
  quantity: number;
  fulfillmentAddress: string;
  solCluster?: SolCluster;
  contact?: string;
}

export interface PaymentAddressInfo {
  chain: Chain;
  tokenSymbol: string;
  amountDisplay: string;
  expectedRawAmount: string;
  address: string;
}

export interface CreateOrderResponse {
  orderId: string;
  status: OrderStatus;
  quantity: number;
  unitPriceUsd: string;
  totalPriceUsd: string;
  createdAt: string;
  expiresAt: string;
  paymentOptions: PaymentAddressInfo[];
}

export interface OrderDetails {
  orderId: string;
  status: OrderStatus;
  productId: ProductId;
  quantity: number;
  unitPriceUsd: string;
  totalPriceUsd: string;
  createdAt: string;
  expiresAt: string;
  paymentTxHash?: string;
  shipmentTxHash?: string;
  failReason?: string;
  latePaymentFlag: boolean;
  extraPaymentFlag: boolean;
  paymentOptions: PaymentAddressInfo[];
}

export interface SupportTicketRequest {
  orderId: string;
  contactType: 'email' | 'telegram';
  contactValue: string;
  message: string;
}

export interface SupportTicketResponse {
  ticketId: string;
  status: 'open';
  createdAt: string;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_DETECTED', 'EXPIRED'],
  PAYMENT_DETECTED: ['PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT'],
  PAYMENT_CONFIRMED: ['DISPATCH_ENQUEUED', 'EXTRA_PAYMENT'],
  DISPATCH_ENQUEUED: ['DISPATCH_SENT', 'FULFILL_FAILED_MANUAL'],
  DISPATCH_SENT: ['FULFILLED', 'FULFILL_FAILED_MANUAL'],
  FULFILLED: [],
  FULFILL_FAILED_MANUAL: [],
  EXPIRED: ['EXTRA_PAYMENT'],
  EXTRA_PAYMENT: [],
};
