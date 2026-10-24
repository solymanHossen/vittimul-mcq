import { ApiProperty } from '@nestjs/swagger';
import type { ExamSectionDetail } from '../interfaces/exam.interface';

export class ExamSectionEntity {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 1, nullable: true })
  subjectId: number | null;

  @ApiProperty({ example: 'English' })
  title: string;

  @ApiProperty({ example: 1 })
  displayOrder: number;

  @ApiProperty({ example: 25 })
  totalMarks: number;

  @ApiProperty({ example: 10, nullable: true })
  sectionalCutoff: number | null;

  @ApiProperty({ example: 20, nullable: true })
  durationMinutes: number | null;

  constructor(section: ExamSectionDetail) {
    this.id = section.id;
    this.subjectId = section.subjectId;
    this.title = section.title;
    this.displayOrder = section.displayOrder;
    this.totalMarks = section.totalMarks;
    this.sectionalCutoff = section.sectionalCutoff;
    this.durationMinutes = section.durationMinutes;
  }
}
