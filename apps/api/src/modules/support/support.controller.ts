import { Body, Controller, Post } from '@nestjs/common';
import { CreateSupportTicketDto } from './create-support-ticket.dto';
import { SupportService } from './support.service';

@Controller('support_tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  async create(@Body() payload: CreateSupportTicketDto) {
    return this.support.createTicket(payload);
  }
}
