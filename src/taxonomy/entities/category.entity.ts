import { ApiProperty } from '@nestjs/swagger';

export class CategoryEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Bank Job Preparation' })
  name: string;

  @ApiProperty({ example: 'bank-job-preparation' })
  slug: string;

  @ApiProperty({ example: 'MCQs for BCS, Bank, and other competitive exams', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/icons/bank.svg', nullable: true })
  iconUrl: string | null;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: CategoryEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.description = partial.description;
    this.iconUrl = partial.iconUrl;
    this.displayOrder = partial.displayOrder;
    this.isActive = partial.isActive;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
