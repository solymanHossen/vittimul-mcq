import { ApiProperty } from '@nestjs/swagger';

export class TopicEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  subjectId: number;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Parent topic id, if this is a sub-topic',
  })
  parentId: number | null;

  @ApiProperty({ example: 'Grammar' })
  name: string;

  @ApiProperty({ example: 'grammar' })
  slug: string;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: TopicEntity) {
    this.id = partial.id;
    this.subjectId = partial.subjectId;
    this.parentId = partial.parentId;
    this.name = partial.name;
    this.slug = partial.slug;
    this.displayOrder = partial.displayOrder;
    this.isActive = partial.isActive;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
