import { ApiProperty } from '@nestjs/swagger';
import type { FavoriteDetail } from '../interfaces/srs.interface';

export class FavoriteEntity {
  @ApiProperty({ example: '2' })
  questionId: string;

  @ApiProperty({ example: 'Default' })
  folderName: string;

  @ApiProperty({ nullable: true })
  personalNote: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ example: 'What is the capital of Bangladesh?' })
  questionText: string;

  constructor(favorite: FavoriteDetail) {
    this.questionId = favorite.questionId;
    this.folderName = favorite.folderName;
    this.personalNote = favorite.personalNote;
    this.createdAt = favorite.createdAt;
    this.questionText = favorite.questionText;
  }
}
