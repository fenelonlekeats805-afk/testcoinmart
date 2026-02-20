import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { V1_PRODUCT_IDS } from '../../common/v1-products';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: [...V1_PRODUCT_IDS] },
        enabled: true,
      },
    });
    const byId = new Map(products.map((item) => [item.id, item]));

    return V1_PRODUCT_IDS.map((productId) => byId.get(productId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
      productId: item.id,
      name: item.name,
      priceUsd: item.priceUsd.toString(),
      minPurchaseQty: item.minPurchaseQty,
      quantityStep: item.quantityStep,
      enabled: item.enabled,
      fulfillmentKind: item.fulfillmentKind,
      requiresSolCluster: item.requiresSolCluster,
    }));
  }
}
