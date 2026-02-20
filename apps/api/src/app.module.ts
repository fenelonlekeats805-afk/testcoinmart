import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './common/prisma.module';
import { RateLimitService } from './common/rate-limit.service';
import { RedisService } from './common/redis.service';
import { TelegramNotifierService } from './common/telegram-notifier.service';
import { ProductsController } from './modules/products/products.controller';
import { ProductsService } from './modules/products/products.service';
import { OrdersController } from './modules/orders/orders.controller';
import { OrdersService } from './modules/orders/orders.service';
import { OrdersQueueProcessor } from './modules/orders/orders.processor';
import { SupportController } from './modules/support/support.controller';
import { SupportService } from './modules/support/support.service';
import { SkillsController } from './modules/skills/skills.controller';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { AdminAuthService } from './modules/admin/admin-auth.service';
import { AdminGuard } from './modules/admin/admin.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    BullModule.registerQueue({ name: 'dispatch' }),
    PrismaModule,
  ],
  controllers: [
    ProductsController,
    OrdersController,
    SupportController,
    SkillsController,
    AdminController,
  ],
  providers: [
    RedisService,
    RateLimitService,
    TelegramNotifierService,
    ProductsService,
    OrdersService,
    OrdersQueueProcessor,
    SupportService,
    AdminAuthService,
    AdminService,
    AdminGuard,
  ],
})
export class AppModule {}

