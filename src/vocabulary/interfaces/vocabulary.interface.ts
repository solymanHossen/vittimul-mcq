import { type DifficultyLevel } from '@prisma/client';

export interface VocabularyCardDetail {
  id: string;
  topicId: number | null;
  word: string;
  pronunciationIpa: string | null;
  partOfSpeech: string | null;
  englishDefinition: string | null;
  bengaliMeaning: string;
  synonyms: string[];
  antonyms: string[];
  mnemonicTrick: string | null;
  exampleSentence: string | null;
  audioPronounceUrl: string | null;
  difficulty: DifficultyLevel;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedVocabularyCards {
  items: VocabularyCardDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface DueVocabularyCard extends VocabularyCardDetail {
  leitnerBox: number;
  isNew: boolean;
}

export interface VocabularyProgressResult {
  cardId: string;
  leitnerBox: number;
  correctStreak: number;
  wrongCount: number;
  isMastered: boolean;
  nextReviewDate: Date;
  lastReviewedAt: Date;
}
