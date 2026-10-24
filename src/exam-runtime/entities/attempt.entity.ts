import { ApiProperty } from '@nestjs/swagger';
import { AttemptStatus } from '@prisma/client';
import type {
  AttemptResult,
  AttemptStartResult,
  AttemptSummary,
} from '../interfaces/attempt-detail.interface';
import { RuntimeQuestionEntity } from './runtime-question.entity';

export class AttemptSummaryEntity {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: '1' })
  examId: string;

  @ApiProperty({ example: 1 })
  attemptNumber: number;

  @ApiProperty({ example: true })
  isOfficial: boolean;

  @ApiProperty({ example: false })
  isPracticeArchive: boolean;

  @ApiProperty({ enum: AttemptStatus })
  status: AttemptStatus;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty()
  expiresAt: Date;

  constructor(summary: AttemptSummary) {
    this.id = summary.id;
    this.examId = summary.examId;
    this.attemptNumber = summary.attemptNumber;
    this.isOfficial = summary.isOfficial;
    this.isPracticeArchive = summary.isPracticeArchive;
    this.status = summary.status;
    this.startedAt = summary.startedAt;
    this.expiresAt = summary.expiresAt;
  }
}

export class AttemptStartEntity {
  @ApiProperty({ type: AttemptSummaryEntity })
  attempt: AttemptSummaryEntity;

  @ApiProperty({ type: [RuntimeQuestionEntity] })
  questions: RuntimeQuestionEntity[];

  constructor(result: AttemptStartResult) {
    this.attempt = new AttemptSummaryEntity(result.attempt);
    this.questions = result.questions.map((question) => new RuntimeQuestionEntity(question));
  }
}

export class AttemptResultEntity {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: '1' })
  examId: string;

  @ApiProperty({ enum: AttemptStatus })
  status: AttemptStatus;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  evaluatedAt: Date;

  @ApiProperty({ example: 48 })
  totalAnswered: number;

  @ApiProperty({ example: 40 })
  totalCorrect: number;

  @ApiProperty({ example: 8 })
  totalWrong: number;

  @ApiProperty({ example: 2 })
  totalUnanswered: number;

  @ApiProperty({ example: 40 })
  rawPositiveMarks: number;

  @ApiProperty({ example: 4 })
  negativeDeducted: number;

  @ApiProperty({ example: 36 })
  obtainedScore: number;

  @ApiProperty({ example: 83.33 })
  accuracyRate: number;

  @ApiProperty({ example: true })
  isPassed: boolean;

  @ApiProperty({ example: 2730 })
  timeTakenSeconds: number;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  subjectWiseBreakdown: AttemptResult['subjectWiseBreakdown'];

  constructor(result: AttemptResult) {
    this.id = result.id;
    this.examId = result.examId;
    this.status = result.status;
    this.submittedAt = result.submittedAt;
    this.evaluatedAt = result.evaluatedAt;
    this.totalAnswered = result.totalAnswered;
    this.totalCorrect = result.totalCorrect;
    this.totalWrong = result.totalWrong;
    this.totalUnanswered = result.totalUnanswered;
    this.rawPositiveMarks = result.rawPositiveMarks;
    this.negativeDeducted = result.negativeDeducted;
    this.obtainedScore = result.obtainedScore;
    this.accuracyRate = result.accuracyRate;
    this.isPassed = result.isPassed;
    this.timeTakenSeconds = result.timeTakenSeconds;
    this.subjectWiseBreakdown = result.subjectWiseBreakdown;
  }
}
