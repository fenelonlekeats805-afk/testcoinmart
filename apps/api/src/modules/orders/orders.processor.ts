import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrdersService } from './orders.service';

@Processor('dispatch')
export class OrdersQueueProcessor extends WorkerHost {
  constructor(private readonly orders: OrdersService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    if (job.name === 'expire-check') {
      await this.orders.expireOrderIfUnpaid(job.data.orderId);
    }
  }
}
