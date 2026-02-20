import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

export class CreateSupportTicketDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty({ enum: ['email', 'telegram'] })
  @IsIn(['email', 'telegram'])
  contactType!: 'email' | 'telegram';

  @ApiProperty()
  @IsString()
  @Length(3, 128)
  contactValue!: string;

  @ApiProperty()
  @IsString()
  @Length(5, 3000)
  message!: string;
}
