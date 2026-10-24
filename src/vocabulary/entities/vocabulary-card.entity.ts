import { ApiProperty } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import type { VocabularyCardDetail } from '../interfaces/vocabulary.interface';

export class VocabularyCardEntity {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 1, nullable: true })
  topicId: number | null;

  @ApiProperty({ example: 'Ubiquitous' })
  word: string;

  @ApiProperty({ nullable: true, example: '/juːˈbɪkwɪtəs/' })
  pronunciationIpa: string | null;

  @ApiProperty({ nullable: true, example: 'adjective' })
  partOfSpeech: string | null;

  @ApiProperty({ nullable: true })
  englishDefinition: string | null;

  @ApiProperty({ example: 'সর্বব্যাপী' })
  bengaliMeaning: string;

  @ApiProperty({ type: [String] })
  synonyms: string[];

  @ApiProperty({ type: [String] })
  antonyms: string[];

  @ApiProperty({ nullable: true })
  mnemonicTrick: string | null;

  @ApiProperty({ nullable: true })
  exampleSentence: string | null;

  @ApiProperty({ nullable: true })
  audioPronounceUrl: string | null;

  @ApiProperty({ enum: DifficultyLevel })
  difficulty: DifficultyLevel;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(card: VocabularyCardDetail) {
    this.id = card.id;
    this.topicId = card.topicId;
    this.word = card.word;
    this.pronunciationIpa = card.pronunciationIpa;
    this.partOfSpeech = card.partOfSpeech;
    this.englishDefinition = card.englishDefinition;
    this.bengaliMeaning = card.bengaliMeaning;
    this.synonyms = card.synonyms;
    this.antonyms = card.antonyms;
    this.mnemonicTrick = card.mnemonicTrick;
    this.exampleSentence = card.exampleSentence;
    this.audioPronounceUrl = card.audioPronounceUrl;
    this.difficulty = card.difficulty;
    this.isActive = card.isActive;
    this.createdAt = card.createdAt;
    this.updatedAt = card.updatedAt;
  }
}
