import { type PaymentProvider, type PaymentState } from '@prisma/client';

export interface PackageDetail {
  id: number;
  categoryId: number | null;
  title: string;
  slug: string;
  durationDays: number;
  basePrice: number;
  sellingPrice: number;
  currency: string;
  featuresList: unknown;
  displayOrder: number;
  isPopular: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponValidationResult {
  valid: true;
  code: string;
  discountAmount: number;
  finalAmount: number;
}

export interface PaymentTransactionDetail {
  id: string;
  packageId: number | null;
  couponId: number | null;
  subtotalAmount: number;
  discountAmount: number;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  transactionReference: string | null;
  status: PaymentState;
  createdAt: Date;
}
