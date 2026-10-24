import { ApiProperty } from '@nestjs/swagger';
import type { CouponValidationResult } from '../interfaces/billing.interface';

export class CouponValidationEntity {
  @ApiProperty({ example: true })
  valid: true;

  @ApiProperty({ example: 'WELCOME10' })
  code: string;

  @ApiProperty({ example: 79.9 })
  discountAmount: number;

  @ApiProperty({ example: 719.1 })
  finalAmount: number;

  constructor(result: CouponValidationResult) {
    this.valid = result.valid;
    this.code = result.code;
    this.discountAmount = result.discountAmount;
    this.finalAmount = result.finalAmount;
  }
}
