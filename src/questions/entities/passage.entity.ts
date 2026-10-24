import { ApiProperty } from '@nestjs/swagger';
import type { PassageDetail } from '../interfaces/question-detail.interface';

export class PassageEntity {
  @ApiProperty({ example: '12', description: 'BigInt id, serialized as a string' })
  id: string;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({ example: 'Read the following passage and answer the questions below...' })
  passageText: string;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(detail: PassageDetail) {
    this.id = detail.id;
    this.title = detail.title;
    this.passageText = detail.passageText;
    this.imageUrl = detail.imageUrl;
    this.createdAt = detail.createdAt;
    this.updatedAt = detail.updatedAt;
  }
}
