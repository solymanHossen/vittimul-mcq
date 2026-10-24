import { ApiProperty } from '@nestjs/swagger';
import { ExamType } from '@prisma/client';
import type { ExamStatus, ExamSummary } from '../interfaces/exam.interface';

export class ExamSummaryEntity {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 1, nullable: true })
  categoryId: number | null;

  @ApiProperty({ example: 'October Mock Test' })
  title: string;

  @ApiProperty({ example: 'october-mock-test' })
  slug: string;

  @ApiProperty({ enum: ExamType })
  examType: ExamType;

  @ApiProperty({ example: 100 })
  totalQuestions: number;

  @ApiProperty({ example: 100 })
  totalMarks: number;

  @ApiProperty({ example: 90 })
  durationMinutes: number;

  @ApiProperty({ example: false })
  isPremiumOnly: boolean;

  @ApiProperty()
  startTime: Date;

  @ApiProperty()
  endTime: Date;

  @ApiProperty({ example: 'live', enum: ['upcoming', 'live', 'archived'] })
  status: ExamStatus;

  constructor(summary: ExamSummary) {
    this.id = summary.id;
    this.categoryId = summary.categoryId;
    this.title = summary.title;
    this.slug = summary.slug;
    this.examType = summary.examType;
    this.totalQuestions = summary.totalQuestions;
    this.totalMarks = summary.totalMarks;
    this.durationMinutes = summary.durationMinutes;
    this.isPremiumOnly = summary.isPremiumOnly;
    this.startTime = summary.startTime;
    this.endTime = summary.endTime;
    this.status = summary.status;
  }
}
