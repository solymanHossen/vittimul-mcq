import { ApiProperty } from '@nestjs/swagger';

export class SubjectEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ example: 'English' })
  name: string;

  @ApiProperty({ example: 'english' })
  slug: string;

  @ApiProperty({ example: 'ENG', nullable: true })
  code: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/icons/english.svg', nullable: true })
  iconUrl: string | null;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: SubjectEntity) {
    this.id = partial.id;
    this.categoryId = partial.categoryId;
    this.name = partial.name;
    this.slug = partial.slug;
    this.code = partial.code;
    this.iconUrl = partial.iconUrl;
    this.displayOrder = partial.displayOrder;
    this.isActive = partial.isActive;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
