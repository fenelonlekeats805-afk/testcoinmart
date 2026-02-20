-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('BSC', 'TRON', 'SOL', 'BASE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'DISPATCH_ENQUEUED', 'DISPATCH_SENT', 'FULFILLED', 'FULFILL_FAILED_MANUAL', 'EXPIRED', 'EXTRA_PAYMENT');

-- CreateEnum
CREATE TYPE "FulfillmentKind" AS ENUM ('EVM', 'SOLANA', 'TON', 'SUI_NATIVE');

-- CreateEnum
CREATE TYPE "SolCluster" AS ENUM ('devnet', 'testnet');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUsd" DECIMAL(20,8) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fulfillmentKind" "FulfillmentKind" NOT NULL,
    "requiresSolCluster" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfillmentAddress" TEXT NOT NULL,
    "deliveryInfo" JSONB NOT NULL,
    "solCluster" "SolCluster",
    "contact" TEXT,
    "failReason" TEXT,
    "latePaymentFlag" BOOLEAN NOT NULL DEFAULT false,
    "extraPaymentFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPaymentAddress" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenContract" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amountDisplay" DECIMAL(20,8) NOT NULL,
    "expectedRawAmount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPaymentAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "tokenContract" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "rawAmount" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dispatcher" TEXT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainConfig" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "confirmThreshold" INTEGER NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressPool" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenContract" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "inUse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddressPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyLock" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatcherCursor" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "tokenContract" TEXT NOT NULL,
    "lastScannedBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatcherCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPaymentAddress_address_chain_idx" ON "OrderPaymentAddress"("address", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPaymentAddress_orderId_chain_tokenSymbol_key" ON "OrderPaymentAddress"("orderId", "chain", "tokenSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txHash_key" ON "Payment"("txHash");

-- CreateIndex
CREATE INDEX "Payment_orderId_chain_idx" ON "Payment"("orderId", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_eventType_idx" ON "OrderEvent"("orderId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ChainConfig_chain_key" ON "ChainConfig"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AddressPool_address_key" ON "AddressPool"("address");

-- CreateIndex
CREATE INDEX "AddressPool_chain_tokenSymbol_inUse_idx" ON "AddressPool"("chain", "tokenSymbol", "inUse");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyLock_lockKey_key" ON "IdempotencyLock"("lockKey");

-- CreateIndex
CREATE UNIQUE INDEX "WatcherCursor_chain_tokenContract_key" ON "WatcherCursor"("chain", "tokenContract");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPaymentAddress" ADD CONSTRAINT "OrderPaymentAddress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

