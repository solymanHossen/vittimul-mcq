import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../database/prisma.service';

function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toString() };
}

const mockTx = {
  paymentTransaction: { update: jest.fn() },
  userSubscription: { create: jest.fn() },
  coupon: { update: jest.fn() },
};

const mockPrisma = {
  package: { create: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  coupon: { create: jest.fn(), findUnique: jest.fn() },
  paymentTransaction: {
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
};

const TRANSACTION_ROW = {
  id: 'txn-1',
  packageId: 1,
  couponId: null,
  subtotalAmount: decimal(799),
  discountAmount: decimal(0),
  amount: decimal(799),
  currency: 'BDT',
  provider: 'BKASH',
  idempotencyKey: 'order-1',
  transactionReference: 'order-1',
  status: 'INITIATED',
  createdAt: new Date(),
};

function activeCoupon(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    code: 'WELCOME10',
    isActive: true,
    startsAt: new Date('2020-01-01'),
    expiresAt: new Date('2099-01-01'),
    maxUsesTotal: null,
    usedCount: 0,
    minPurchaseAmount: decimal(0),
    maxUsesPerUser: 1,
    discountType: 'PERCENTAGE',
    discountValue: decimal(10),
    maxDiscountAmount: null,
    ...overrides,
  };
}

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    );
  });

  describe('validateCoupon()', () => {
    it('computes a percentage discount capped to the purchase amount', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(799) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(activeCoupon());
      mockPrisma.paymentTransaction.count.mockResolvedValueOnce(0);

      const result = await service.validateCoupon(1, { code: 'WELCOME10', packageId: 1 });

      expect(result).toEqual({
        valid: true,
        code: 'WELCOME10',
        discountAmount: 79.9,
        finalAmount: 719.1,
      });
    });

    it('caps the discount at maxDiscountAmount when set', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(10000) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        activeCoupon({ discountValue: decimal(50), maxDiscountAmount: decimal(100) }),
      );
      mockPrisma.paymentTransaction.count.mockResolvedValueOnce(0);

      const result = await service.validateCoupon(1, { code: 'WELCOME10', packageId: 1 });

      expect(result.discountAmount).toBe(100);
    });

    it('computes a flat FIXED_AMOUNT discount regardless of purchase size', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(1000) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        activeCoupon({ discountType: 'FIXED_AMOUNT', discountValue: decimal(50) }),
      );
      mockPrisma.paymentTransaction.count.mockResolvedValueOnce(0);

      const result = await service.validateCoupon(1, { code: 'FLAT50', packageId: 1 });

      expect(result.discountAmount).toBe(50);
    });

    it('rejects an expired coupon', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(799) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        activeCoupon({ expiresAt: new Date('2020-01-01') }),
      );

      await expect(service.validateCoupon(1, { code: 'EXPIRED', packageId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a coupon that has hit its total usage limit', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(799) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        activeCoupon({ maxUsesTotal: 5, usedCount: 5 }),
      );

      await expect(service.validateCoupon(1, { code: 'MAXED', packageId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a coupon the user has already used up to their per-user limit', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(799) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(activeCoupon({ maxUsesPerUser: 1 }));
      mockPrisma.paymentTransaction.count.mockResolvedValueOnce(1);

      await expect(service.validateCoupon(1, { code: 'ONCE', packageId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a purchase below the minimum purchase amount', async () => {
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ sellingPrice: decimal(50) });
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        activeCoupon({ minPurchaseAmount: decimal(100) }),
      );

      await expect(service.validateCoupon(1, { code: 'BIGSPENDER', packageId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkout()', () => {
    const dto = { packageId: 1, provider: 'BKASH' as const, idempotencyKey: 'order-1' };

    it('returns the existing transaction on a repeat idempotencyKey without creating a new one', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce(TRANSACTION_ROW);

      const result = await service.checkout(1, dto);

      expect(mockPrisma.package.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(mockPrisma.paymentTransaction.create).not.toHaveBeenCalled();
      expect(result.id).toBe('txn-1');
    });

    it('creates a new transaction with the package price when no coupon is applied', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce(null);
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({
        id: 1,
        sellingPrice: decimal(799),
        isActive: true,
      });
      mockPrisma.paymentTransaction.create.mockResolvedValueOnce(TRANSACTION_ROW);

      await service.checkout(1, dto);

      expect(mockPrisma.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalAmount: 799,
            discountAmount: 0,
            amount: 799,
            status: 'INITIATED',
          }),
        }),
      );
    });

    it('rejects checkout for an inactive package', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce(null);
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({
        id: 1,
        sellingPrice: decimal(799),
        isActive: false,
      });

      await expect(service.checkout(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('re-fetches and returns the existing row on a P2002 race instead of throwing', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce(null);
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({
        id: 1,
        sellingPrice: decimal(799),
        isActive: true,
      });
      mockPrisma.paymentTransaction.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );
      mockPrisma.paymentTransaction.findUniqueOrThrow.mockResolvedValueOnce(TRANSACTION_ROW);

      const result = await service.checkout(1, dto);

      expect(result.id).toBe('txn-1');
    });
  });

  describe('handleWebhook()', () => {
    it('throws NotFoundException when no transaction matches the reference', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.handleWebhook({ transactionReference: 'missing', status: 'SUCCESS' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('is a no-op for an already-SUCCESS transaction (idempotent retry)', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce({
        id: 'txn-1',
        status: 'SUCCESS',
        packageId: 1,
        userId: 1,
        couponId: null,
      });

      await service.handleWebhook({ transactionReference: 'order-1', status: 'SUCCESS' });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks the transaction FAILED on a failure callback without creating a subscription', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce({
        id: 'txn-1',
        status: 'INITIATED',
        packageId: 1,
        userId: 1,
        couponId: null,
      });

      await service.handleWebhook({
        transactionReference: 'order-1',
        status: 'FAILED',
        failureReason: 'Insufficient balance',
      });

      expect(mockPrisma.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks SUCCESS, creates a PREMIUM subscription, and increments coupon usage on a success callback', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce({
        id: 'txn-1',
        status: 'INITIATED',
        packageId: 1,
        userId: 7,
        couponId: 3,
      });
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ durationDays: 90 });

      await service.handleWebhook({
        transactionReference: 'order-1',
        status: 'SUCCESS',
        gatewayTransactionId: 'gw-123',
      });

      expect(mockTx.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) }),
      );
      expect(mockTx.userSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 7, packageId: 1, status: 'PREMIUM' }),
        }),
      );
      expect(mockTx.coupon.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 }, data: { usedCount: { increment: 1 } } }),
      );
    });

    it('skips the coupon increment when no coupon was applied', async () => {
      mockPrisma.paymentTransaction.findUnique.mockResolvedValueOnce({
        id: 'txn-1',
        status: 'INITIATED',
        packageId: 1,
        userId: 7,
        couponId: null,
      });
      mockPrisma.package.findUniqueOrThrow.mockResolvedValueOnce({ durationDays: 90 });

      await service.handleWebhook({ transactionReference: 'order-1', status: 'SUCCESS' });

      expect(mockTx.coupon.update).not.toHaveBeenCalled();
    });
  });
});
