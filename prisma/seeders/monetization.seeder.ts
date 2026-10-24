import {
  PrismaClient,
  DiscountType,
  PaymentProvider,
  PaymentState,
  SubscriptionStatus,
  Prisma,
} from '@prisma/client';
import type { Seeder } from './seeder.interface';

interface SeedCouponPlan {
  readonly code: string;
  readonly description: string;
  readonly discountType: DiscountType;
  readonly discountValue: string;
  readonly maxDiscountAmount: string | null;
  readonly minPurchaseAmount: string;
}

export class MonetizationSeeder implements Seeder {
  readonly name = 'MonetizationSeeder';
  readonly description =
    'Seeds discount coupons, real-world payment transactions, and active subscriptions';
  readonly order = 5;

  private static readonly COUPONS_PLAN: SeedCouponPlan[] = [
    {
      code: 'WELCOME50',
      description: '50% discount for first-time aspirants across all packages',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '50.00',
      maxDiscountAmount: '200.00',
      minPurchaseAmount: '250.00',
    },
    {
      code: 'EID2026',
      description: 'Special festive discount of BDT 150 on multi-month subscriptions',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: '150.00',
      maxDiscountAmount: '150.00',
      minPurchaseAmount: '500.00',
    },
    {
      code: 'BCSTOPPER',
      description: 'Merit-based 25% discount for dedicated exam qualifiers',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '25.00',
      maxDiscountAmount: '500.00',
      minPurchaseAmount: '700.00',
    },
  ];

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('💳 Seeding Monetization (Coupons, Payments, Subscriptions)...');

    const now = new Date();
    const couponStarts = new Date(now.getTime() - 30 * 86_400_000);
    const couponExpires = new Date(now.getTime() + 180 * 86_400_000);

    // 1. Seed Coupons
    const couponByCode = new Map<string, number>();
    for (const plan of MonetizationSeeder.COUPONS_PLAN) {
      const coupon = await prisma.coupon.upsert({
        where: { code: plan.code },
        create: {
          code: plan.code,
          description: plan.description,
          discountType: plan.discountType,
          discountValue: new Prisma.Decimal(plan.discountValue),
          maxDiscountAmount: plan.maxDiscountAmount
            ? new Prisma.Decimal(plan.maxDiscountAmount)
            : null,
          minPurchaseAmount: new Prisma.Decimal(plan.minPurchaseAmount),
          maxUsesTotal: 1000,
          maxUsesPerUser: 1,
          usedCount: 15,
          startsAt: couponStarts,
          expiresAt: couponExpires,
          isActive: true,
        },
        update: {
          discountValue: new Prisma.Decimal(plan.discountValue),
          isActive: true,
        },
        select: { id: true, code: true },
      });
      couponByCode.set(coupon.code, coupon.id);
    }
    console.info(`🎟️ Ensured ${couponByCode.size} promotional coupons.`);

    // 2. Resolve Packages
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (packages.length === 0) {
      console.warn('⚠️ No packages found; skipping payment and subscription seeding.');
      return;
    }

    // 3. Resolve Users for Subscriptions
    const regularUsers = await prisma.user.findMany({
      where: { role: 'USER' },
      take: 6,
      orderBy: { id: 'asc' },
      select: { id: true, phoneNumber: true },
    });

    if (regularUsers.length === 0) {
      console.warn('⚠️ No regular users found; skipping subscription seeding.');
      return;
    }

    const pkgOneMonth = packages.find((p) => p.slug === '1-month-premium') ?? packages[0];
    const pkgThreeMonths = packages.find((p) => p.slug === '3-months-premium') ?? packages[0];
    const pkgOneYear =
      packages.find((p) => p.slug === '1-year-premium') ?? packages[packages.length - 1];

    const welcomeCouponId = couponByCode.get('WELCOME50');

    // 4. Seed Simulated Payment Transactions and User Subscriptions
    const paymentConfigs = [
      {
        userIndex: 0,
        package: pkgThreeMonths,
        provider: PaymentProvider.BKASH,
        subtotal: pkgThreeMonths.sellingPrice,
        discount: new Prisma.Decimal('150.00'),
        amount: new Prisma.Decimal(Number(pkgThreeMonths.sellingPrice) - 150),
        status: PaymentState.SUCCESS,
        couponId: welcomeCouponId,
        daysValid: 90,
        subStatus: SubscriptionStatus.PREMIUM,
      },
      {
        userIndex: 1,
        package: pkgOneYear,
        provider: PaymentProvider.SSLCOMMERZ,
        subtotal: pkgOneYear.sellingPrice,
        discount: new Prisma.Decimal('200.00'),
        amount: new Prisma.Decimal(Number(pkgOneYear.sellingPrice) - 200),
        status: PaymentState.SUCCESS,
        couponId: welcomeCouponId,
        daysValid: 365,
        subStatus: SubscriptionStatus.PREMIUM,
      },
      {
        userIndex: 2,
        package: pkgOneMonth,
        provider: PaymentProvider.NAGAD,
        subtotal: pkgOneMonth.sellingPrice,
        discount: new Prisma.Decimal('0.00'),
        amount: pkgOneMonth.sellingPrice,
        status: PaymentState.SUCCESS,
        couponId: null,
        daysValid: 30,
        subStatus: SubscriptionStatus.PREMIUM,
      },
      {
        userIndex: 3,
        package: pkgOneMonth,
        provider: PaymentProvider.ROCKET,
        subtotal: pkgOneMonth.sellingPrice,
        discount: new Prisma.Decimal('0.00'),
        amount: pkgOneMonth.sellingPrice,
        status: PaymentState.FAILED,
        couponId: null,
        daysValid: 0,
        subStatus: null,
      },
    ];

    let createdTxCount = 0;
    let createdSubCount = 0;

    for (const [idx, cfg] of paymentConfigs.entries()) {
      const user = regularUsers[cfg.userIndex];
      if (!user) continue;

      const idempotencyKey = `seed-idem-${user.id}-${cfg.package.id}-${idx}`;
      const trxRef = `TRX-VIT-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}-${user.id}-${idx}`;
      const gwTrxId = `GW-${cfg.provider.substring(0, 3)}-${100000 + idx * 777}`;

      const gatewayRawResponse: Prisma.InputJsonValue = {
        gateway: cfg.provider,
        transactionId: gwTrxId,
        currency: 'BDT',
        status: cfg.status,
        statusCode: cfg.status === PaymentState.SUCCESS ? '0000' : '9999',
        bankTrxId: `BNK-${Math.floor(Math.random() * 899999 + 100000)}`,
        verifiedAt: now.toISOString(),
      };

      // Idempotent upsert on idempotencyKey
      const existingTx = await prisma.paymentTransaction.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });

      let txId: string;
      if (existingTx) {
        txId = existingTx.id;
      } else {
        const tx = await prisma.paymentTransaction.create({
          data: {
            userId: user.id,
            packageId: cfg.package.id,
            couponId: cfg.couponId,
            subtotalAmount: cfg.subtotal,
            discountAmount: cfg.discount,
            amount: cfg.amount,
            currency: 'BDT',
            provider: cfg.provider,
            idempotencyKey,
            transactionReference: trxRef,
            gatewayTransactionId: gwTrxId,
            senderPhoneNumber: user.phoneNumber ?? '01712345678',
            status: cfg.status,
            failureReason:
              cfg.status === PaymentState.FAILED ? 'Insufficient balance in wallet' : null,
            gatewayRawResponse,
            paidAt: cfg.status === PaymentState.SUCCESS ? now : null,
          },
          select: { id: true },
        });
        txId = tx.id;
        createdTxCount++;
      }

      // If payment was successful and subscription status applies, create/upsert UserSubscription
      if (cfg.status === PaymentState.SUCCESS && cfg.subStatus) {
        const validFrom = new Date(now);
        const validUntil = new Date(now.getTime() + cfg.daysValid * 86_400_000);

        const existingSub = await prisma.userSubscription.findUnique({
          where: { paymentTransactionId: txId },
          select: { id: true },
        });

        if (!existingSub) {
          await prisma.userSubscription.create({
            data: {
              userId: user.id,
              packageId: cfg.package.id,
              paymentTransactionId: txId,
              validFrom,
              validUntil,
              status: cfg.subStatus,
              autoRenew: false,
            },
          });
          createdSubCount++;
        }
      }
    }

    console.info(
      `🧾 Seeded ${createdTxCount} payment transactions and ${createdSubCount} active user subscriptions.`,
    );
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    const couponCodes = MonetizationSeeder.COUPONS_PLAN.map((c) => c.code);
    await prisma.coupon.deleteMany({ where: { code: { in: couponCodes } } });
    console.info('↩️ MonetizationSeeder rolled back.');
  }
}
