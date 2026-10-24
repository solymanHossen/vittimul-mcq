import { ApiProperty } from '@nestjs/swagger';
import { DifficultyLevel, QuestionNavState } from '@prisma/client';
import type {
  RuntimeOption,
  RuntimePassage,
  RuntimeQuestionWithState,
} from '../interfaces/runtime-question.interface';

export class RuntimeOptionEntity {
  @ApiProperty({ example: '101' })
  optionId: string;

  @ApiProperty({ example: 'A' })
  optionLabel: string;

  @ApiProperty({ example: 'Dhaka' })
  optionText: string;

  @ApiProperty({ nullable: true })
  optionImageUrl: string | null;

  constructor(option: RuntimeOption) {
    this.optionId = option.optionId;
    this.optionLabel = option.optionLabel;
    this.optionText = option.optionText;
    this.optionImageUrl = option.optionImageUrl;
  }
}

export class RuntimePassageEntity {
  @ApiProperty({ example: '12' })
  id: string;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty()
  passageText: string;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  constructor(passage: RuntimePassage) {
    this.id = passage.id;
    this.title = passage.title;
    this.passageText = passage.passageText;
    this.imageUrl = passage.imageUrl;
  }
}

export class RuntimeQuestionEntity {
  @ApiProperty({ example: '501' })
  questionId: string;

  @ApiProperty({ example: null, nullable: true })
  sectionId: string | null;

  @ApiProperty({ example: 1 })
  questionOrder: number;

  @ApiProperty({ example: 1 })
  marks: number;

  @ApiProperty({ example: 0.5 })
  negativeMarks: number;

  @ApiProperty({ example: 'What is the capital of Bangladesh?' })
  questionText: string;

  @ApiProperty({ nullable: true })
  questionImageUrl: string | null;

  @ApiProperty({ enum: DifficultyLevel })
  difficulty: DifficultyLevel;

  @ApiProperty({ example: false })
  isMultipleChoice: boolean;

  @ApiProperty({ type: RuntimePassageEntity, nullable: true })
  passage: RuntimePassageEntity | null;

  @ApiProperty({ type: [RuntimeOptionEntity] })
  options: RuntimeOptionEntity[];

  @ApiProperty({ example: null, nullable: true })
  selectedOptionId: string | null;

  @ApiProperty({ type: [String] })
  selectedOptionIds: string[];

  @ApiProperty({ enum: QuestionNavState })
  navState: QuestionNavState;

  @ApiProperty({ example: false, description: 'OMR-locked — this answer can no longer be changed' })
  isLocked: boolean;

  constructor(question: RuntimeQuestionWithState) {
    this.questionId = question.questionId;
    this.sectionId = question.sectionId;
    this.questionOrder = question.questionOrder;
    this.marks = question.marks;
    this.negativeMarks = question.negativeMarks;
    this.questionText = question.questionText;
    this.questionImageUrl = question.questionImageUrl;
    this.difficulty = question.difficulty;
    this.isMultipleChoice = question.isMultipleChoice;
    this.passage = question.passage ? new RuntimePassageEntity(question.passage) : null;
    this.options = question.options.map((option) => new RuntimeOptionEntity(option));
    this.selectedOptionId = question.selectedOptionId;
    this.selectedOptionIds = question.selectedOptionIds;
    this.navState = question.navState;
    this.isLocked = question.isLocked;
  }
}
