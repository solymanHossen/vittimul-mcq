import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentProvider, Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WEBHOOK_TOKEN_HEADER } from './billing.constants';
import { BillingService } from './billing.service';
import { CreatePackageSchema, type CreatePackageDto } from './dto/create-package.dto';
import { CreateCouponSchema, type CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponSchema, type ValidateCouponDto } from './dto/validate-coupon.dto';
import { CheckoutSchema, type CheckoutDto } from './dto/checkout.dto';
import { WebhookPayloadSchema, type WebhookPayloadDto } from './dto/webhook-payload.dto';
import { PackageEntity } from './entities/package.entity';
import { CouponValidationEntity } from './entities/coupon-validation.entity';
import { PaymentTransactionEntity } from './entities/payment-transaction.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  @Get('packages')
  @Public()
  @ApiOperation({ summary: 'List active subscription packages' })
  @ApiResponse({ status: HttpStatus.OK, type: [PackageEntity] })
  async listPackages(): Promise<{ message: string; data: PackageEntity[] }> {
    const packages = await this.billingService.listPackages();
    return {
      message: 'Packages retrieved successfully',
      data: packages.map((pkg) => new PackageEntity(pkg)),
    };
  }

  @Post('packages')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a subscription package' })
  @ApiBody({ schema: z.toJSONSchema(CreatePackageSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: PackageEntity })
  async createPackage(
    @Body(new ZodValidationPipe(CreatePackageSchema)) dto: CreatePackageDto,
  ): Promise<{ message: string; data: PackageEntity }> {
    const pkg = await this.billingService.createPackage(dto);
    return { message: 'Package created successfully', data: new PackageEntity(pkg) };
  }

  @Post('coupons')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a discount coupon' })
  @ApiBody({
    // startsAt/endsAt are z.coerce.date() — see exams.controller.ts.
    schema: z.toJSONSchema(CreateCouponSchema, {
      unrepresentable: 'any',
    }) as unknown as ApiBodySchema,
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Coupon created' })
  async createCoupon(
    @Body(new ZodValidationPipe(CreateCouponSchema)) dto: CreateCouponDto,
  ): Promise<{ message: string; data: { code: string } }> {
    const coupon = await this.billingService.createCoupon(dto);
    return { message: 'Coupon created successfully', data: coupon };
  }

  @Post('coupons/validate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate a coupon code against a package and compute the discount' })
  @ApiBody({ schema: z.toJSONSchema(ValidateCouponSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: CouponValidationEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Coupon invalid, expired, or usage limit reached',
  })
  async validateCoupon(
    @Body(new ZodValidationPipe(ValidateCouponSchema)) dto: ValidateCouponDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: CouponValidationEntity }> {
    const result = await this.billingService.validateCoupon(user.id, dto);
    return { message: 'Coupon is valid', data: new CouponValidationEntity(result) };
  }

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Idempotently initiate a package purchase' })
  @ApiBody({ schema: z.toJSONSchema(CheckoutSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: PaymentTransactionEntity })
  async checkout(
    @Body(new ZodValidationPipe(CheckoutSchema)) dto: CheckoutDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: PaymentTransactionEntity }> {
    const transaction = await this.billingService.checkout(user.id, dto);
    return {
      message: 'Checkout initiated successfully',
      data: new PaymentTransactionEntity(transaction),
    };
  }

  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiHeader({ name: WEBHOOK_TOKEN_HEADER, required: true })
  @ApiOperation({
    summary: 'Payment gateway callback',
    description:
      'Generic normalized callback shape gated by a shared-secret header. Real provider ' +
      'integration (bKash, Stripe, etc.) needs a per-provider adapter in front of this that ' +
      "verifies that provider's own signature scheme and maps its payload to WebhookPayloadDto.",
  })
  @ApiBody({ schema: z.toJSONSchema(WebhookPayloadSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or missing webhook token' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers(WEBHOOK_TOKEN_HEADER) token: string | undefined,
    @Body(new ZodValidationPipe(WebhookPayloadSchema)) dto: WebhookPayloadDto,
  ): Promise<{ message: string; data: null }> {
    this.assertValidProvider(provider);
    this.assertValidWebhookToken(token);

    await this.billingService.handleWebhook(dto);
    return { message: 'Webhook processed successfully', data: null };
  }

  private assertValidProvider(provider: string): void {
    if (!Object.values(PaymentProvider).includes(provider as PaymentProvider)) {
      throw new ForbiddenException('Unknown payment provider');
    }
  }

  private assertValidWebhookToken(token: string | undefined): void {
    const expected = this.configService.getOrThrow<string>('BILLING_WEBHOOK_SECRET');
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid or missing webhook token');
    }
  }
}
