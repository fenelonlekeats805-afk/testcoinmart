import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { AdminAuthService } from './admin-auth.service';
import { assertTransition } from '../orders/state-machine';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AdminAuthService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    if (!user) {
      throw new NotFoundException('Admin user not found');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Invalid credentials');
    }

    return {
      accessToken: this.auth.sign({ sub: user.id, username: user.username }),
      username: user.username,
    };
  }

  async listOrders(status?: string) {
    return this.prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        payments: true,
        shipment: true,
      },
      take: 200,
    });
  }

  async listTickets(status?: 'open' | 'closed') {
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      include: { order: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async closeTicket(ticketId: string) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'closed' },
    });
  }

  async manualFulfill(orderId: string, txHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== 'FULFILL_FAILED_MANUAL' && order.status !== 'DISPATCH_SENT') {
        throw new BadRequestException('Order is not eligible for manual fulfill');
      }

      if (order.shipment) {
        await tx.shipment.update({
          where: { orderId },
          data: { txHash, status: 'SENT_MANUAL' },
        });
      } else {
        await tx.shipment.create({
          data: {
            orderId,
            dispatcher: 'manual-admin',
            txHash,
            status: 'SENT_MANUAL',
          },
        });
      }

      assertTransition(order.status, 'FULFILLED');
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'FULFILLED', failReason: null },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          eventType: 'MANUAL_FULFILL',
          payload: { txHash },
        },
      });

      return { orderId, txHash, status: 'FULFILLED' };
    });
  }

  async retryDispatch(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status !== 'FULFILL_FAILED_MANUAL') {
        throw new BadRequestException('Only failed manual fulfillment orders can be retried');
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'DISPATCH_ENQUEUED',
          failReason: null,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          eventType: 'MANUAL_RETRY_DISPATCH',
          payload: {},
        },
      });

      return { orderId, status: 'DISPATCH_ENQUEUED' };
    });
  }

  async listExtraPayments() {
    return this.prisma.order.findMany({
      where: { extraPaymentFlag: true },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getChainConfigs() {
    return this.prisma.chainConfig.findMany({ orderBy: { chain: 'asc' } });
  }

  async updateChainConfig(chain: 'BSC' | 'TRON' | 'SOL' | 'BASE', confirmThreshold: number, rpcUrl: string, active: boolean) {
    return this.prisma.chainConfig.upsert({
      where: { chain },
      create: { chain, confirmThreshold, rpcUrl, active },
      update: { confirmThreshold, rpcUrl, active },
    });
  }

  async updateProduct(
    productId: string,
    data: { priceUsd?: string; minPurchaseQty?: number; quantityStep?: number; enabled?: boolean },
  ) {
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        priceUsd: data.priceUsd,
        minPurchaseQty: data.minPurchaseQty,
        quantityStep: data.quantityStep,
        enabled: data.enabled,
      },
    });
  }
}
