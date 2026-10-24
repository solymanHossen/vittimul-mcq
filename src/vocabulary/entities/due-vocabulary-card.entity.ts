import { ApiProperty } from '@nestjs/swagger';
import type { DueVocabularyCard } from '../interfaces/vocabulary.interface';
import { VocabularyCardEntity } from './vocabulary-card.entity';

export class DueVocabularyCardEntity extends VocabularyCardEntity {
  @ApiProperty({
    example: 1,
    description: "1 for a never-reviewed card, else the card's current Leitner box",
  })
  leitnerBox: number;

  @ApiProperty({ example: true })
  isNew: boolean;

  constructor(card: DueVocabularyCard) {
    super(card);
    this.leitnerBox = card.leitnerBox;
    this.isNew = card.isNew;
  }
}
