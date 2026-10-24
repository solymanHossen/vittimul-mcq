import { ApiProperty } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import type { DueQuestion, DueQuestionOption } from '../interfaces/srs.interface';

export class DueQuestionOptionEntity {
  @ApiProperty({ example: '5' })
  id: string;

  @ApiProperty({ example: 'A' })
  optionLabel: string;

  @ApiProperty({ example: 'Dhaka' })
  optionText: string;

  @ApiProperty({ nullable: true })
  optionImageUrl: string | null;

  @ApiProperty({ example: true })
  isCorrect: boolean;

  constructor(option: DueQuestionOption) {
    this.id = option.id;
    this.optionLabel = option.optionLabel;
    this.optionText = option.optionText;
    this.optionImageUrl = option.optionImageUrl;
    this.isCorrect = option.isCorrect;
  }
}

export class DueQuestionEntity {
  @ApiProperty({ example: '2' })
  questionId: string;

  @ApiProperty({ example: 'What is the capital of Bangladesh?' })
  questionText: string;

  @ApiProperty({ nullable: true })
  questionImageUrl: string | null;

  @ApiProperty({ nullable: true })
  textExplanation: string | null;

  @ApiProperty({ nullable: true })
  explanationImageUrl: string | null;

  @ApiProperty({ enum: DifficultyLevel })
  difficulty: DifficultyLevel;

  @ApiProperty({ example: false })
  isMultipleChoice: boolean;

  @ApiProperty({ type: [DueQuestionOptionEntity] })
  options: DueQuestionOptionEntity[];

  @ApiProperty({ example: 2 })
  repetitionNumber: number;

  @ApiProperty({ example: 6 })
  intervalDays: number;

  @ApiProperty({ example: 2.5 })
  easeFactor: number;

  @ApiProperty()
  nextReviewDate: Date;

  constructor(question: DueQuestion) {
    this.questionId = question.questionId;
    this.questionText = question.questionText;
    this.questionImageUrl = question.questionImageUrl;
    this.textExplanation = question.textExplanation;
    this.explanationImageUrl = question.explanationImageUrl;
    this.difficulty = question.difficulty;
    this.isMultipleChoice = question.isMultipleChoice;
    this.options = question.options.map((option) => new DueQuestionOptionEntity(option));
    this.repetitionNumber = question.repetitionNumber;
    this.intervalDays = question.intervalDays;
    this.easeFactor = question.easeFactor;
    this.nextReviewDate = question.nextReviewDate;
  }
}
