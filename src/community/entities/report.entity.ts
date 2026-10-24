import { ApiProperty } from '@nestjs/swagger';
import { ReportReason, ReportStatus } from '@prisma/client';
import type { ReportDetail } from '../interfaces/community.interface';

export class ReportEntity {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: '501' })
  questionId: string;

  @ApiProperty({ example: 1, nullable: true })
  userId: number | null;

  @ApiProperty({ example: null, nullable: true })
  resolvedById: number | null;

  @ApiProperty({ enum: ReportReason })
  reason: ReportReason;

  @ApiProperty({ nullable: true })
  userNotes: string | null;

  @ApiProperty({ nullable: true })
  screenshotUrl: string | null;

  @ApiProperty({ nullable: true })
  resolutionNotes: string | null;

  @ApiProperty({ enum: ReportStatus })
  status: ReportStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  resolvedAt: Date | null;

  constructor(report: ReportDetail) {
    this.id = report.id;
    this.questionId = report.questionId;
    this.userId = report.userId;
    this.resolvedById = report.resolvedById;
    this.reason = report.reason;
    this.userNotes = report.userNotes;
    this.screenshotUrl = report.screenshotUrl;
    this.resolutionNotes = report.resolutionNotes;
    this.status = report.status;
    this.createdAt = report.createdAt;
    this.resolvedAt = report.resolvedAt;
  }
}
