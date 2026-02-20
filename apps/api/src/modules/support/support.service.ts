import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TelegramNotifierService } from '../../common/telegram-notifier.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotifierService,
  ) {}

  async createTicket(payload: {
    orderId: string;
    contactType: 'email' | 'telegram';
    contactValue: string;
    message: string;
  }) {
    const order = await this.prisma.order.findUnique({ where: { id: payload.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        orderId: payload.orderId,
        contactType: payload.contactType,
        contactValue: payload.contactValue,
        message: payload.message,
      },
    });

    await this.prisma.orderEvent.create({
      data: {
        orderId: payload.orderId,
        eventType: 'SUPPORT_TICKET_CREATED',
        payload: { ticketId: ticket.id },
      },
    });

    await this.telegram.notify(`New support ticket ${ticket.id} for order ${payload.orderId}`);

    return {
      ticketId: ticket.id,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
    };
  }
}
