import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DiscountType, PaymentState, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import {
  CouponValidationResult,
  PackageDetail,
  PaymentTransactionDetail,
} from './interfaces/billing.interface';

const PACKAGE_SELECT = {
  id: true,
  categoryId: true,
  title: true,
  slug: true,
  durationDays: true,
  basePrice: true,
  sellingPrice: true,
  currency: true,
  featuresList: true,
  displayOrder: true,
  isPopular: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PackageSelect;

type PackageRow = Prisma.PackageGetPayload<{ select: typeof PACKAGE_SELECT }>;

const TRANSACTION_SELECT = {
  id: true,
  packageId: true,
  couponId: true,
  subtotalAmount: true,
  discountAmount: true,
  amount: true,
  currency: true,
  provider: true,
  idempotencyKey: true,
  transactionReference: true,
  status: true,
  createdAt: true,
} satisfies Prisma.PaymentTransactionSelect;

type TransactionRow = Prisma.PaymentTransactionGetPayload<{ select: typeof TRANSACTION_SELECT }>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Packages ─────────────────────────────────────────────────────────────

  async createPackage(dto: CreatePackageDto): Promise<PackageDetail> {
    const row = await this.prisma.package.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        slug: dto.slug,
        durationDays: dto.durationDays,
        basePrice: dto.basePrice,
        sellingPrice: dto.sellingPrice,
        currency: dto.currency,
        featuresList: dto.featuresList,
        displayOrder: dto.displayOrder,
        isPopular: dto.isPopular,
      },
      select: PACKAGE_SELECT,
    });
    return this.toPackageDetail(row);
  }

  async listPackages(): Promise<PackageDetail[]> {
    const rows = await this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: PACKAGE_SELECT,
    });
    return rows.map((row) => this.toPackageDetail(row));
  }

  // ── Coupons ──────────────────────────────────────────────────────────────

  async createCoupon(dto: CreateCouponDto): Promise<{ code: string }> {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount,
        minPurchaseAmount: dto.minPurchaseAmount,
        maxUsesTotal: dto.maxUsesTotal,
        maxUsesPerUser: dto.maxUsesPerUser,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
        isActive: dto.isActive,
      },
      select: { code: true },
    });
    return coupon;
  }

  async validateCoupon(userId: number, dto: ValidateCouponDto): Promise<CouponValidationResult> {
    const pkg = await this.prisma.package.findUniqueOrThrow({
      where: { id: dto.packageId },
      select: { sellingPrice: true },
    });

    const result = await this.evaluateCoupon(dto.code, pkg.sellingPrice.toNumber(), userId);
    return {
      valid: true,
      code: dto.code,
      discountAmount: result.discountAmount,
      finalAmount: round2(pkg.sellingPrice.toNumber() - result.discountAmount),
    };
  }

  /** Shared by `validateCoupon` (preview) and `checkout` (authoritative, applied). */
  private async evaluateCoupon(
    code: string,
    amount: number,
    userId: number,
  ): Promise<{ couponId: number; discountAmount: number }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    const now = new Date();

    if (!coupon || !coupon.isActive || coupon.startsAt > now || coupon.expiresAt < now) {
      throw new BadRequestException('Coupon is invalid or expired');
    }
    if (coupon.maxUsesTotal !== null && coupon.usedCount >= coupon.maxUsesTotal) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (amount < coupon.minPurchaseAmount.toNumber()) {
      throw new BadRequestException(
        `A minimum purchase amount of ${coupon.minPurchaseAmount.toString()} is required for this coupon`,
      );
    }

    const userUsageCount = await this.prisma.paymentTransaction.count({
      where: {
        couponId: coupon.id,
        userId,
        status: { in: [PaymentState.SUCCESS, PaymentState.PROCESSING, PaymentState.INITIATED] },
      },
    });
    if (userUsageCount >= coupon.maxUsesPerUser) {
      throw new BadRequestException('You have already used this coupon');
    }

    let discountAmount =
      coupon.discountType === DiscountType.PERCENTAGE
        ? amount * (coupon.discountValue.toNumber() / 100)
        : coupon.discountValue.toNumber();

    if (coupon.maxDiscountAmount !== null) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount.toNumber());
    }
    discountAmount = Math.min(discountAmount, amount);

    return { couponId: coupon.id, discountAmount: round2(discountAmount) };
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  /**
   * Idempotent: a retry with the same `idempotencyKey` returns the original
   * transaction instead of creating a duplicate. The P2002 catch handles the
   * narrow race where two concurrent requests both pass the initial
   * `findUnique` check before either `create` commits.
   */
  async checkout(userId: number, dto: CheckoutDto): Promise<PaymentTransactionDetail> {
    const existing = await this.prisma.paymentTransaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      select: TRANSACTION_SELECT,
    });
    if (existing) {
      return this.toTransactionDetail(existing);
    }

    const pkg = await this.prisma.package.findUniqueOrThrow({
      where: { id: dto.packageId },
      select: { id: true, sellingPrice: true, isActive: true },
    });
    if (!pkg.isActive) {
      throw new BadRequestException('This package is not available for purchase');
    }

    const subtotalAmount = pkg.sellingPrice.toNumber();
    let discountAmount = 0;
    let couponId: number | null = null;
    if (dto.couponCode) {
      const result = await this.evaluateCoupon(dto.couponCode, subtotalAmount, userId);
      discountAmount = result.discountAmount;
      couponId = result.couponId;
    }
    const amount = round2(Math.max(0, subtotalAmount - discountAmount));

    try {
      const row = await this.prisma.paymentTransaction.create({
        data: {
          userId,
          packageId: pkg.id,
          couponId,
          subtotalAmount,
          discountAmount,
          amount,
          provider: dto.provider,
          idempotencyKey: dto.idempotencyKey,
          // Simple stand-in reference the generic webhook matches on — a real
          // integration would use whatever reference the gateway's redirect
          // flow returns instead.
          transactionReference: dto.idempotencyKey,
          status: PaymentState.INITIATED,
        },
        select: TRANSACTION_SELECT,
      });
      return this.toTransactionDetail(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const row = await this.prisma.paymentTransaction.findUniqueOrThrow({
          where: { idempotencyKey: dto.idempotencyKey },
          select: TRANSACTION_SELECT,
        });
        return this.toTransactionDetail(row);
      }
      throw error;
    }
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  async handleWebhook(dto: WebhookPayloadDto): Promise<void> {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { transactionReference: dto.transactionReference },
      select: { id: true, status: true, packageId: true, userId: true, couponId: true },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Idempotent: webhook retries for an already-settled transaction are a
    // no-op rather than an error or a duplicate subscription.
    if (transaction.status === PaymentState.SUCCESS || transaction.status === PaymentState.FAILED) {
      return;
    }

    if (dto.status === 'FAILED') {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentState.FAILED,
          failureReason: dto.failureReason,
          gatewayTransactionId: dto.gatewayTransactionId,
          gatewayRawResponse: dto.rawPayload as Prisma.InputJsonValue | undefined,
        },
      });
      return;
    }

    const { userId, packageId } = transaction;
    if (userId === null || packageId === null) {
      throw new BadRequestException('Transaction is missing its user or package reference');
    }

    const pkg = await this.prisma.package.findUniqueOrThrow({
      where: { id: packageId },
      select: { durationDays: true },
    });
    const now = new Date();
    const validUntil = new Date(now.getTime() + pkg.durationDays * 86_400_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentState.SUCCESS,
          paidAt: now,
          gatewayTransactionId: dto.gatewayTransactionId,
          gatewayRawResponse: dto.rawPayload as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.userSubscription.create({
        data: {
          userId,
          packageId,
          paymentTransactionId: transaction.id,
          validFrom: now,
          validUntil,
          status: SubscriptionStatus.PREMIUM,
        },
      });

      if (transaction.couponId !== null) {
        await tx.coupon.update({
          where: { id: transaction.couponId },
          data: { usedCount: { increment: 1 } },
        });
      }
    });
  }

  // ── Mapping ──────────────────────────────────────────────────────────────

  private toPackageDetail(row: PackageRow): PackageDetail {
    return {
      id: row.id,
      categoryId: row.categoryId,
      title: row.title,
      slug: row.slug,
      durationDays: row.durationDays,
      basePrice: row.basePrice.toNumber(),
      sellingPrice: row.sellingPrice.toNumber(),
      currency: row.currency,
      featuresList: row.featuresList,
      displayOrder: row.displayOrder,
      isPopular: row.isPopular,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toTransactionDetail(row: TransactionRow): PaymentTransactionDetail {
    return {
      id: row.id,
      packageId: row.packageId,
      couponId: row.couponId,
      subtotalAmount: row.subtotalAmount.toNumber(),
      discountAmount: row.discountAmount.toNumber(),
      amount: row.amount.toNumber(),
      currency: row.currency,
      provider: row.provider,
      idempotencyKey: row.idempotencyKey,
      transactionReference: row.transactionReference,
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}
