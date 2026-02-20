import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { V1_PRODUCT_IDS, V1ProductId } from '../../common/v1-products';

export class CreateOrderDto {
  @ApiProperty({ enum: V1_PRODUCT_IDS })
  @IsString()
  @IsIn(V1_PRODUCT_IDS)
  productId!: V1ProductId;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsString()
  fulfillmentAddress!: string;

  @ApiProperty({ required: false, enum: ['devnet', 'testnet'] })
  @IsOptional()
  @IsIn(['devnet', 'testnet'])
  solCluster?: 'devnet' | 'testnet';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contact?: string;
}
