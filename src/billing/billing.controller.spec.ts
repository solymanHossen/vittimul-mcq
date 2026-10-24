import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockBillingService = {
  listPackages: jest.fn(),
  createPackage: jest.fn(),
  createCoupon: jest.fn(),
  validateCoupon: jest.fn(),
  checkout: jest.fn(),
  handleWebhook: jest.fn(),
};

const mockConfigService = { getOrThrow: jest.fn().mockReturnValue('expected-secret') };

const user: AuthUser = { id: 1, email: 'user@example.com', role: Role.USER, isActive: true };

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue('expected-secret');
  });

  it('validateCoupon() forwards the current user id and dto', async () => {
    mockBillingService.validateCoupon.mockResolvedValueOnce({
      valid: true,
      code: 'WELCOME10',
      discountAmount: 10,
      finalAmount: 90,
    });
    const dto = { code: 'WELCOME10', packageId: 1 };

    await controller.validateCoupon(dto, user);

    expect(mockBillingService.validateCoupon).toHaveBeenCalledWith(1, dto);
  });

  it('checkout() forwards the current user id and dto', async () => {
    mockBillingService.checkout.mockResolvedValueOnce({
      id: 'txn-1',
      packageId: 1,
      couponId: null,
      subtotalAmount: 799,
      discountAmount: 0,
      amount: 799,
      currency: 'BDT',
      provider: 'BKASH',
      idempotencyKey: 'order-1',
      transactionReference: 'order-1',
      status: 'INITIATED',
      createdAt: new Date(),
    });
    const dto = { packageId: 1, provider: 'BKASH' as const, idempotencyKey: 'order-1' };

    await controller.checkout(dto, user);

    expect(mockBillingService.checkout).toHaveBeenCalledWith(1, dto);
  });

  describe('handleWebhook()', () => {
    const payload = { transactionReference: 'order-1', status: 'SUCCESS' as const };

    it('rejects an unknown payment provider before checking the token', async () => {
      await expect(
        controller.handleWebhook('unknown-provider', 'expected-secret', payload),
      ).rejects.toThrow(ForbiddenException);
      expect(mockBillingService.handleWebhook).not.toHaveBeenCalled();
    });

    it('rejects a missing webhook token', async () => {
      await expect(controller.handleWebhook('BKASH', undefined, payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a mismatched webhook token', async () => {
      await expect(controller.handleWebhook('BKASH', 'wrong-secret', payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockBillingService.handleWebhook).not.toHaveBeenCalled();
    });

    it('processes the webhook once provider and token both check out', async () => {
      mockBillingService.handleWebhook.mockResolvedValueOnce(undefined);

      const result = await controller.handleWebhook('BKASH', 'expected-secret', payload);

      expect(mockBillingService.handleWebhook).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ message: 'Webhook processed successfully', data: null });
    });
  });
});
