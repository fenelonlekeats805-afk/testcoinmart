import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

class ChainConfigDto {
  @IsIn(['BSC', 'TRON', 'SOL', 'BASE'])
  chain!: 'BSC' | 'TRON' | 'SOL' | 'BASE';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  confirmThreshold!: number;

  @IsString()
  rpcUrl!: string;

  @Type(() => Boolean)
  @IsBoolean()
  active!: boolean;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  priceUsd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minPurchaseQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityStep?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

class ManualFulfillDto {
  @IsString()
  txHash!: string;
}

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('login')
  login(@Body() payload: LoginDto) {
    return this.admin.login(payload.username, payload.password);
  }

  @UseGuards(AdminGuard)
  @Get('orders')
  listOrders(@Query('status') status?: string) {
    return this.admin.listOrders(status);
  }

  @UseGuards(AdminGuard)
  @Get('tickets')
  listTickets(@Query('status') status?: 'open' | 'closed') {
    return this.admin.listTickets(status);
  }

  @UseGuards(AdminGuard)
  @Patch('tickets/:ticketId/close')
  closeTicket(@Param('ticketId') ticketId: string) {
    return this.admin.closeTicket(ticketId);
  }

  @UseGuards(AdminGuard)
  @Post('orders/:orderId/manual-fulfill')
  manualFulfill(@Param('orderId') orderId: string, @Body() payload: ManualFulfillDto) {
    return this.admin.manualFulfill(orderId, payload.txHash);
  }

  @UseGuards(AdminGuard)
  @Post('orders/:orderId/retry-dispatch')
  retryDispatch(@Param('orderId') orderId: string) {
    return this.admin.retryDispatch(orderId);
  }

  @UseGuards(AdminGuard)
  @Get('extra-payments')
  listExtraPayments() {
    return this.admin.listExtraPayments();
  }

  @UseGuards(AdminGuard)
  @Get('config/chains')
  getChainConfigs() {
    return this.admin.getChainConfigs();
  }

  @UseGuards(AdminGuard)
  @Patch('config/chains')
  updateChainConfig(@Body() payload: ChainConfigDto) {
    return this.admin.updateChainConfig(payload.chain, payload.confirmThreshold, payload.rpcUrl, payload.active);
  }

  @UseGuards(AdminGuard)
  @Patch('products/:productId')
  updateProduct(@Param('productId') productId: string, @Body() payload: UpdateProductDto) {
    return this.admin.updateProduct(productId, payload);
  }
}
