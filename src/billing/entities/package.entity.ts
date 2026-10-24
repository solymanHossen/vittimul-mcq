import { ApiProperty } from '@nestjs/swagger';
import type { PackageDetail } from '../interfaces/billing.interface';

export class PackageEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1, nullable: true })
  categoryId: number | null;

  @ApiProperty({ example: '3-Month Premium' })
  title: string;

  @ApiProperty({ example: '3-month-premium' })
  slug: string;

  @ApiProperty({ example: 90 })
  durationDays: number;

  @ApiProperty({ example: 999 })
  basePrice: number;

  @ApiProperty({ example: 799 })
  sellingPrice: number;

  @ApiProperty({ example: 'BDT' })
  currency: string;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  featuresList: unknown;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiProperty({ example: false })
  isPopular: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(pkg: PackageDetail) {
    this.id = pkg.id;
    this.categoryId = pkg.categoryId;
    this.title = pkg.title;
    this.slug = pkg.slug;
    this.durationDays = pkg.durationDays;
    this.basePrice = pkg.basePrice;
    this.sellingPrice = pkg.sellingPrice;
    this.currency = pkg.currency;
    this.featuresList = pkg.featuresList;
    this.displayOrder = pkg.displayOrder;
    this.isPopular = pkg.isPopular;
    this.isActive = pkg.isActive;
    this.createdAt = pkg.createdAt;
    this.updatedAt = pkg.updatedAt;
  }
}
