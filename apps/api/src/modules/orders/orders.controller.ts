import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CreateOrderDto } from './create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(
    @Body() payload: CreateOrderDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ) {
    return this.orders.createOrder(payload, headers, req.ip);
  }

  @Get(':orderId')
  async getById(@Param('orderId') orderId: string) {
    return this.orders.getOrder(orderId);
  }
}
