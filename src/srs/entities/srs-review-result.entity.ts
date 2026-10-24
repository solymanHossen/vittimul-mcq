import { ApiProperty } from '@nestjs/swagger';
import type { SrsReviewResult } from '../interfaces/srs.interface';

export class SrsReviewResultEntity {
  @ApiProperty({ example: '2' })
  questionId: string;

  @ApiProperty({ example: 2 })
  repetitionNumber: number;

  @ApiProperty({ example: 0 })
  lapsesCount: number;

  @ApiProperty({ example: 6 })
  intervalDays: number;

  @ApiProperty({ example: 2.5 })
  easeFactor: number;

  @ApiProperty()
  nextReviewDate: Date;

  @ApiProperty({ example: false })
  isMastered: boolean;

  @ApiProperty()
  lastReviewedAt: Date;

  constructor(result: SrsReviewResult) {
    this.questionId = result.questionId;
    this.repetitionNumber = result.repetitionNumber;
    this.lapsesCount = result.lapsesCount;
    this.intervalDays = result.intervalDays;
    this.easeFactor = result.easeFactor;
    this.nextReviewDate = result.nextReviewDate;
    this.isMastered = result.isMastered;
    this.lastReviewedAt = result.lastReviewedAt;
  }
}
