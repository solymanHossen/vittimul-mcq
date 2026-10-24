import { ApiProperty } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import { QuestionOptionEntity, QuestionTagEntity } from './question-option.entity';
import type { QuestionDetail } from '../interfaces/question-detail.interface';

export class QuestionEntity {
  @ApiProperty({ example: '501', description: 'BigInt id, serialized as a string' })
  id: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  uuid: string;

  @ApiProperty({ example: 12, nullable: true })
  topicId: number | null;

  @ApiProperty({ example: null, nullable: true })
  passageId: string | null;

  @ApiProperty({ example: 1, nullable: true })
  createdById: number | null;

  @ApiProperty({ example: null, nullable: true })
  verifiedById: number | null;

  @ApiProperty({ example: 'What is the capital of Bangladesh?' })
  questionText: string;

  @ApiProperty({ nullable: true })
  questionImageUrl: string | null;

  @ApiProperty({ nullable: true })
  textExplanation: string | null;

  @ApiProperty({ nullable: true })
  explanationImageUrl: string | null;

  @ApiProperty({ nullable: true })
  audioExplanationUrl: string | null;

  @ApiProperty({ nullable: true })
  videoExplanationUrl: string | null;

  @ApiProperty({ nullable: true })
  sourceReference: string | null;

  @ApiProperty({ enum: DifficultyLevel, example: DifficultyLevel.MEDIUM })
  difficulty: DifficultyLevel;

  @ApiProperty({ example: false })
  isMultipleChoice: boolean;

  @ApiProperty({ example: 1 })
  defaultMarks: number;

  @ApiProperty({ example: 0.5 })
  defaultNegative: number;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: false })
  isFrozen: boolean;

  @ApiProperty({ example: 0 })
  totalFacedCount: number;

  @ApiProperty({ example: 0 })
  totalCorrectCount: number;

  @ApiProperty({ example: 0 })
  totalSkippedCount: number;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [QuestionOptionEntity] })
  options: QuestionOptionEntity[];

  @ApiProperty({ type: [QuestionTagEntity] })
  tags: QuestionTagEntity[];

  constructor(detail: QuestionDetail) {
    this.id = detail.id;
    this.uuid = detail.uuid;
    this.topicId = detail.topicId;
    this.passageId = detail.passageId;
    this.createdById = detail.createdById;
    this.verifiedById = detail.verifiedById;
    this.questionText = detail.questionText;
    this.questionImageUrl = detail.questionImageUrl;
    this.textExplanation = detail.textExplanation;
    this.explanationImageUrl = detail.explanationImageUrl;
    this.audioExplanationUrl = detail.audioExplanationUrl;
    this.videoExplanationUrl = detail.videoExplanationUrl;
    this.sourceReference = detail.sourceReference;
    this.difficulty = detail.difficulty;
    this.isMultipleChoice = detail.isMultipleChoice;
    this.defaultMarks = detail.defaultMarks;
    this.defaultNegative = detail.defaultNegative;
    this.version = detail.version;
    this.isFrozen = detail.isFrozen;
    this.totalFacedCount = detail.totalFacedCount;
    this.totalCorrectCount = detail.totalCorrectCount;
    this.totalSkippedCount = detail.totalSkippedCount;
    this.isVerified = detail.isVerified;
    this.isActive = detail.isActive;
    this.createdAt = detail.createdAt;
    this.updatedAt = detail.updatedAt;
    this.options = detail.options.map((option) => new QuestionOptionEntity(option));
    this.tags = detail.tags.map((tag) => new QuestionTagEntity(tag));
  }
}
