import { ApiProperty } from '@nestjs/swagger';
import { PaymentProvider, PaymentState } from '@prisma/client';
import type { PaymentTransactionDetail } from '../interfaces/billing.interface';

export class PaymentTransactionEntity {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: 1, nullable: true })
  packageId: number | null;

  @ApiProperty({ example: null, nullable: true })
  couponId: number | null;

  @ApiProperty({ example: 799 })
  subtotalAmount: number;

  @ApiProperty({ example: 0 })
  discountAmount: number;

  @ApiProperty({ example: 799 })
  amount: number;

  @ApiProperty({ example: 'BDT' })
  currency: string;

  @ApiProperty({ enum: PaymentProvider })
  provider: PaymentProvider;

  @ApiProperty({ example: 'order-2026-10-24-abc123' })
  idempotencyKey: string;

  @ApiProperty({ nullable: true })
  transactionReference: string | null;

  @ApiProperty({ enum: PaymentState })
  status: PaymentState;

  @ApiProperty()
  createdAt: Date;

  constructor(transaction: PaymentTransactionDetail) {
    this.id = transaction.id;
    this.packageId = transaction.packageId;
    this.couponId = transaction.couponId;
    this.subtotalAmount = transaction.subtotalAmount;
    this.discountAmount = transaction.discountAmount;
    this.amount = transaction.amount;
    this.currency = transaction.currency;
    this.provider = transaction.provider;
    this.idempotencyKey = transaction.idempotencyKey;
    this.transactionReference = transaction.transactionReference;
    this.status = transaction.status;
    this.createdAt = transaction.createdAt;
  }
}
