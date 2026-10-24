import { ApiProperty } from '@nestjs/swagger';
import type { SyllabusTrackerDetail } from '../interfaces/compass.interface';

export class SyllabusTrackerEntity {
  @ApiProperty({ example: 1 })
  topicId: number;

  @ApiProperty({ example: true })
  isCompleted: boolean;

  @ApiProperty({ example: 4, nullable: true })
  confidenceRating: number | null;

  @ApiProperty({ example: 20 })
  questionsAttempted: number;

  @ApiProperty({ example: 85 })
  accuracyPercent: number;

  @ApiProperty({ example: 2 })
  revisionCount: number;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty({ nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  updatedAt: Date;

  constructor(tracker: SyllabusTrackerDetail) {
    this.topicId = tracker.topicId;
    this.isCompleted = tracker.isCompleted;
    this.confidenceRating = tracker.confidenceRating;
    this.questionsAttempted = tracker.questionsAttempted;
    this.accuracyPercent = tracker.accuracyPercent;
    this.revisionCount = tracker.revisionCount;
    this.notes = tracker.notes;
    this.completedAt = tracker.completedAt;
    this.updatedAt = tracker.updatedAt;
  }
}
