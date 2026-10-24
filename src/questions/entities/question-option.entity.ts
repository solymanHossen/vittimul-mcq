import { ApiProperty } from '@nestjs/swagger';

export class QuestionOptionEntity {
  @ApiProperty({ example: '101', description: 'BigInt id, serialized as a string' })
  id: string;

  @ApiProperty({ example: 'A' })
  optionLabel: string;

  @ApiProperty({ example: 'Dhaka' })
  optionText: string;

  @ApiProperty({ nullable: true })
  optionImageUrl: string | null;

  @ApiProperty({ example: true })
  isCorrect: boolean;

  @ApiProperty({ example: 1 })
  displayOrder: number;

  constructor(partial: QuestionOptionEntity) {
    this.id = partial.id;
    this.optionLabel = partial.optionLabel;
    this.optionText = partial.optionText;
    this.optionImageUrl = partial.optionImageUrl;
    this.isCorrect = partial.isCorrect;
    this.displayOrder = partial.displayOrder;
  }
}

export class QuestionTagEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Capital Cities' })
  name: string;

  @ApiProperty({ example: 'capital-cities' })
  slug: string;

  constructor(partial: QuestionTagEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
  }
}
