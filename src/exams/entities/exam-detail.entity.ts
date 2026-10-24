import { ApiProperty } from '@nestjs/swagger';
import { ExamType } from '@prisma/client';
import type { ExamDetail } from '../interfaces/exam.interface';
import { ExamSectionEntity } from './exam-section.entity';

export class ExamDetailEntity {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  uuid: string;

  @ApiProperty({ example: 1, nullable: true })
  categoryId: number | null;

  @ApiProperty({ example: null, nullable: true })
  tournamentId: number | null;

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

  @ApiProperty({ example: 40 })
  passMarks: number;

  @ApiProperty({ example: 90 })
  durationMinutes: number;

  @ApiProperty({ example: 0.25 })
  negativeMarkingRate: number;

  @ApiProperty({ example: true })
  isOmrMode: boolean;

  @ApiProperty({ example: false })
  shuffleQuestions: boolean;

  @ApiProperty({ example: false })
  shuffleOptions: boolean;

  @ApiProperty({ example: false })
  isPremiumOnly: boolean;

  @ApiProperty({ example: false })
  allowMultipleRetakes: boolean;

  @ApiProperty({ example: 1 })
  maxRetakesAllowed: number;

  @ApiProperty({ example: 3 })
  maxTabSwitchesAllowed: number;

  @ApiProperty({ nullable: true })
  syllabusDescription: string | null;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  studyMaterials: unknown;

  @ApiProperty()
  startTime: Date;

  @ApiProperty()
  endTime: Date;

  @ApiProperty({ nullable: true })
  resultPublishTime: Date | null;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiProperty({ example: false })
  isResultsPublished: boolean;

  @ApiProperty({ example: 0 })
  totalParticipants: number;

  @ApiProperty({ nullable: true })
  highestScore: number | null;

  @ApiProperty({ nullable: true })
  averageScore: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [ExamSectionEntity] })
  sections: ExamSectionEntity[];

  constructor(detail: ExamDetail) {
    this.id = detail.id;
    this.uuid = detail.uuid;
    this.categoryId = detail.categoryId;
    this.tournamentId = detail.tournamentId;
    this.title = detail.title;
    this.slug = detail.slug;
    this.examType = detail.examType;
    this.totalQuestions = detail.totalQuestions;
    this.totalMarks = detail.totalMarks;
    this.passMarks = detail.passMarks;
    this.durationMinutes = detail.durationMinutes;
    this.negativeMarkingRate = detail.negativeMarkingRate;
    this.isOmrMode = detail.isOmrMode;
    this.shuffleQuestions = detail.shuffleQuestions;
    this.shuffleOptions = detail.shuffleOptions;
    this.isPremiumOnly = detail.isPremiumOnly;
    this.allowMultipleRetakes = detail.allowMultipleRetakes;
    this.maxRetakesAllowed = detail.maxRetakesAllowed;
    this.maxTabSwitchesAllowed = detail.maxTabSwitchesAllowed;
    this.syllabusDescription = detail.syllabusDescription;
    this.studyMaterials = detail.studyMaterials;
    this.startTime = detail.startTime;
    this.endTime = detail.endTime;
    this.resultPublishTime = detail.resultPublishTime;
    this.isPublished = detail.isPublished;
    this.isResultsPublished = detail.isResultsPublished;
    this.totalParticipants = detail.totalParticipants;
    this.highestScore = detail.highestScore;
    this.averageScore = detail.averageScore;
    this.createdAt = detail.createdAt;
    this.updatedAt = detail.updatedAt;
    this.sections = detail.sections.map((section) => new ExamSectionEntity(section));
  }
}
