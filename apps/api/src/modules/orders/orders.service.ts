import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Chain, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RateLimitService } from '../../common/rate-limit.service';
import { CreateOrderDto } from './create-order.dto';
import { assertTransition } from './state-machine';
import { toRawAmount, validateFulfillmentAddress } from './order-utils';

interface TokenOption {
  chain: Chain;
  tokenSymbol: string;
  contractEnv: string;
  decimalsEnv: string;
}

const paymentOptions: TokenOption[] = [
  { chain: 'BSC', tokenSymbol: 'USDT', contractEnv: 'BSC_USDT_CONTRACT', decimalsEnv: 'BSC_USDT_DECIMALS' },
  { chain: 'BSC', tokenSymbol: 'USDC', contractEnv: 'BSC_USDC_CONTRACT', decimalsEnv: 'BSC_USDC_DECIMALS' },
  { chain: 'TRON', tokenSymbol: 'USDT', contractEnv: 'TRON_USDT_CONTRACT', decimalsEnv: 'TRON_USDT_DECIMALS' },
  { chain: 'SOL', tokenSymbol: 'USDT', contractEnv: 'SOL_USDT_MINT', decimalsEnv: 'SOL_USDT_DECIMALS' },
  { chain: 'SOL', tokenSymbol: 'USDC', contractEnv: 'SOL_USDC_MINT', decimalsEnv: 'SOL_USDC_DECIMALS' },
  { chain: 'BASE', tokenSymbol: 'USDC', contractEnv: 'BASE_USDC_CONTRACT', decimalsEnv: 'BASE_USDC_DECIMALS' },
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    @InjectQueue('dispatch') private readonly dispatchQueue: Queue,
  ) {}

  private requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new ServiceUnavailableException(`Missing required configuration: ${name}`);
    }
    return value;
  }

  private loadTokenConfig(option: TokenOption): { tokenContract: string; decimals: number } {
    const tokenContract = this.requireEnv(option.contractEnv);
    const decimals = Number(this.requireEnv(option.decimalsEnv));
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      throw new ServiceUnavailableException(`Invalid decimals for ${option.tokenSymbol} on ${option.chain}`);
    }
    const normalizedTokenContract = (option.chain === 'BSC' || option.chain === 'BASE')
      ? tokenContract.toLowerCase()
      : tokenContract;
    return { tokenContract: normalizedTokenContract, decimals };
  }

  private getClientIp(headers: Record<string, string | string[] | undefined>, fallback = 'unknown'): string {
    const xff = headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
    return fallback;
  }

  private assertSolanaCluster(product: Product, dto: CreateOrderDto): void {
    if (product.requiresSolCluster && !dto.solCluster) {
      throw new BadRequestException('solCluster is required for Solana SKU');
    }
    if (!product.requiresSolCluster && dto.solCluster) {
      throw new BadRequestException('solCluster is only allowed for Solana SKU');
    }
  }

  private assertQuantity(product: Product, quantity: number): void {
    if (!Number.isInteger(product.quantityStep) || product.quantityStep <= 0) {
      throw new ServiceUnavailableException(`Invalid quantityStep for product ${product.id}`);
    }
    if (!Number.isInteger(product.minPurchaseQty) || product.minPurchaseQty <= 0) {
      throw new ServiceUnavailableException(`Invalid minPurchaseQty for product ${product.id}`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer');
    }
    if (quantity < product.minPurchaseQty) {
      throw new BadRequestException(`quantity must be >= ${product.minPurchaseQty}`);
    }
    if ((quantity - product.minPurchaseQty) % product.quantityStep !== 0) {
      throw new BadRequestException(
        `quantity must follow step=${product.quantityStep} from min=${product.minPurchaseQty}`,
      );
    }
  }

  private buildDeliveryInfo(product: Product, dto: CreateOrderDto) {
    if (product.fulfillmentKind === 'SOLANA') {
      return {
        network: 'solana',
        cluster: dto.solCluster,
        address: dto.fulfillmentAddress,
      };
    }
    if (product.fulfillmentKind === 'SUI_NATIVE') {
      return {
        network: 'sui',
        cluster: 'testnet',
        address: dto.fulfillmentAddress,
      };
    }
    return {
      network: product.fulfillmentKind.toLowerCase(),
      address: dto.fulfillmentAddress,
    };
  }

  async createOrder(dto: CreateOrderDto, headers: Record<string, string | string[] | undefined>, ip?: string) {
    const clientIp = ip ?? this.getClientIp(headers);
    await this.rateLimit.assertIpOrderLimit(clientIp);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || !product.enabled) {
      throw new NotFoundException('Product not found or disabled');
    }

    this.assertSolanaCluster(product, dto);
    this.assertQuantity(product, dto.quantity);
    validateFulfillmentAddress(product.fulfillmentKind, dto.fulfillmentAddress);

    const expiryMinutes = Number(process.env.ORDER_EXPIRY_MINUTES || 10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    const tokenRows = paymentOptions.map((option) => {
      const token = this.loadTokenConfig(option);
      const unitRawAmount = toRawAmount(product.priceUsd.toString(), token.decimals);
      const expectedRawAmount = (BigInt(unitRawAmount) * BigInt(dto.quantity)).toString();
      return {
        ...option,
        ...token,
        amountDisplay: product.priceUsd.mul(dto.quantity),
        expectedRawAmount,
      };
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          productId: dto.productId,
          quantity: dto.quantity,
          status: 'PENDING_PAYMENT',
          fulfillmentAddress: dto.fulfillmentAddress,
          deliveryInfo: this.buildDeliveryInfo(product, dto),
          solCluster: dto.solCluster,
          contact: dto.contact,
          expiresAt,
        },
      });

      for (const row of tokenRows) {
        const poolAddress = await tx.addressPool.findFirst({
          where: {
            chain: row.chain,
            tokenSymbol: row.tokenSymbol,
            inUse: false,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!poolAddress) {
          throw new ServiceUnavailableException(`Address pool exhausted for ${row.chain}/${row.tokenSymbol}`);
        }

        await tx.addressPool.update({
          where: { id: poolAddress.id },
          data: { inUse: true },
        });

        await tx.orderPaymentAddress.create({
          data: {
            orderId: order.id,
            chain: row.chain,
            tokenSymbol: row.tokenSymbol,
            tokenContract: row.tokenContract,
            address: poolAddress.address,
            amountDisplay: row.amountDisplay,
            expectedRawAmount: row.expectedRawAmount,
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'ORDER_CREATED',
          payload: {
            ip: clientIp,
            quantity: dto.quantity,
          },
        },
      });

      return order;
    });

    await this.dispatchQueue.add(
      'expire-check',
      { orderId: result.id },
      {
        delay: expiryMinutes * 60 * 1000,
        jobId: `expire-${result.id}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    return this.getOrder(result.id);
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        paymentAddresses: true,
        payments: true,
        shipment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const latestPayment = order.payments.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())[0];

    return {
      orderId: order.id,
      status: order.status,
      productId: order.productId,
      quantity: order.quantity,
      unitPriceUsd: order.product.priceUsd.toString(),
      totalPriceUsd: order.product.priceUsd.mul(order.quantity).toString(),
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
      paymentTxHash: latestPayment?.txHash,
      shipmentTxHash: order.shipment?.txHash || undefined,
      failReason: order.failReason || undefined,
      latePaymentFlag: order.latePaymentFlag,
      extraPaymentFlag: order.extraPaymentFlag,
      paymentOptions: order.paymentAddresses.map((item) => ({
        chain: item.chain,
        tokenSymbol: item.tokenSymbol,
        amountDisplay: item.amountDisplay.toString(),
        expectedRawAmount: item.expectedRawAmount,
        address: item.address,
      })),
    };
  }

  async expireOrderIfUnpaid(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return;
      }
      if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_DETECTED') {
        return;
      }
      if (order.expiresAt.getTime() > Date.now()) {
        return;
      }
      assertTransition(order.status, 'EXPIRED');
      await tx.order.update({ where: { id: orderId }, data: { status: 'EXPIRED' } });
      await tx.orderEvent.create({
        data: {
          orderId,
          eventType: 'ORDER_EXPIRED',
          payload: {},
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
