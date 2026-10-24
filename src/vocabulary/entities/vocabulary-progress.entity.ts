import { ApiProperty } from '@nestjs/swagger';
import type { VocabularyProgressResult } from '../interfaces/vocabulary.interface';

export class VocabularyProgressEntity {
  @ApiProperty({ example: '1' })
  cardId: string;

  @ApiProperty({ example: 3 })
  leitnerBox: number;

  @ApiProperty({ example: 2 })
  correctStreak: number;

  @ApiProperty({ example: 0 })
  wrongCount: number;

  @ApiProperty({ example: false })
  isMastered: boolean;

  @ApiProperty()
  nextReviewDate: Date;

  @ApiProperty()
  lastReviewedAt: Date;

  constructor(progress: VocabularyProgressResult) {
    this.cardId = progress.cardId;
    this.leitnerBox = progress.leitnerBox;
    this.correctStreak = progress.correctStreak;
    this.wrongCount = progress.wrongCount;
    this.isMastered = progress.isMastered;
    this.nextReviewDate = progress.nextReviewDate;
    this.lastReviewedAt = progress.lastReviewedAt;
  }
}
