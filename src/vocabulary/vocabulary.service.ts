import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { startOfUtcDay, addDays } from '../common/utils/date.util';
import { applyLeitnerReview } from './leitner.util';
import { MAX_DUE_CARDS } from './vocabulary.constants';
import { CreateVocabularyCardDto } from './dto/create-vocabulary-card.dto';
import { QueryVocabularyCardsDto } from './dto/query-vocabulary-cards.dto';
import { ReviewCardDto } from './dto/review-card.dto';
import {
  DueVocabularyCard,
  PaginatedVocabularyCards,
  VocabularyCardDetail,
  VocabularyProgressResult,
} from './interfaces/vocabulary.interface';

const CARD_SELECT = {
  id: true,
  topicId: true,
  word: true,
  pronunciationIpa: true,
  partOfSpeech: true,
  englishDefinition: true,
  bengaliMeaning: true,
  synonyms: true,
  antonyms: true,
  mnemonicTrick: true,
  exampleSentence: true,
  audioPronounceUrl: true,
  difficulty: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VocabularyCardSelect;

type CardRow = Prisma.VocabularyCardGetPayload<{ select: typeof CARD_SELECT }>;

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async createCard(dto: CreateVocabularyCardDto): Promise<VocabularyCardDetail> {
    const row = await this.prisma.vocabularyCard.create({ data: dto, select: CARD_SELECT });
    return this.toCardDetail(row);
  }

  async listCards(query: QueryVocabularyCardsDto): Promise<PaginatedVocabularyCards> {
    const where: Prisma.VocabularyCardWhereInput = {
      ...(query.topicId !== undefined ? { topicId: query.topicId } : {}),
      ...(query.difficulty !== undefined ? { difficulty: query.difficulty } : {}),
    };
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      this.prisma.vocabularyCard.findMany({
        where,
        select: CARD_SELECT,
        orderBy: { word: 'asc' },
        skip,
        take: query.limit,
      }),
      this.prisma.vocabularyCard.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toCardDetail(row)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /**
   * Due cards = cards with progress overdue for this user, topped up with
   * never-touched ("new") active cards up to MAX_DUE_CARDS. Three bounded
   * queries regardless of deck size, never a per-card lookup.
   */
  async getDueCards(userId: number): Promise<DueVocabularyCard[]> {
    const today = startOfUtcDay(new Date());

    const dueProgress = await this.prisma.userVocabularyProgress.findMany({
      where: { userId, isMastered: false, nextReviewDate: { lte: today } },
      orderBy: { nextReviewDate: 'asc' },
      take: MAX_DUE_CARDS,
      select: { leitnerBox: true, card: { select: CARD_SELECT } },
    });

    const dueCards: DueVocabularyCard[] = dueProgress.map((progress) => ({
      ...this.toCardDetail(progress.card),
      leitnerBox: progress.leitnerBox,
      isNew: false,
    }));

    const remaining = MAX_DUE_CARDS - dueCards.length;
    if (remaining <= 0) {
      return dueCards;
    }

    const touchedCardIds = await this.prisma.userVocabularyProgress.findMany({
      where: { userId },
      select: { cardId: true },
    });

    const newCards = await this.prisma.vocabularyCard.findMany({
      where: { isActive: true, id: { notIn: touchedCardIds.map((row) => row.cardId) } },
      orderBy: { id: 'asc' },
      take: remaining,
      select: CARD_SELECT,
    });

    return [
      ...dueCards,
      ...newCards.map((card) => ({ ...this.toCardDetail(card), leitnerBox: 1, isNew: true })),
    ];
  }

  async reviewCard(userId: number, dto: ReviewCardDto): Promise<VocabularyProgressResult> {
    const cardId = BigInt(dto.cardId);
    const today = startOfUtcDay(new Date());

    const existing = await this.prisma.userVocabularyProgress.findUnique({
      where: { userId_cardId: { userId, cardId } },
      select: { leitnerBox: true, correctStreak: true },
    });

    const current = {
      leitnerBox: existing?.leitnerBox ?? 1,
      correctStreak: existing?.correctStreak ?? 0,
    };
    const result = applyLeitnerReview(current, dto.isRemembered);
    const nextReviewDate = addDays(today, result.intervalDays);
    const lastReviewedAt = new Date();

    const row = await this.prisma.userVocabularyProgress.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: {
        userId,
        cardId,
        leitnerBox: result.leitnerBox,
        correctStreak: result.correctStreak,
        wrongCount: result.wrongIncrement,
        isMastered: result.isMastered,
        nextReviewDate,
        lastReviewedAt,
      },
      update: {
        leitnerBox: result.leitnerBox,
        correctStreak: result.correctStreak,
        wrongCount: { increment: result.wrongIncrement },
        isMastered: result.isMastered,
        nextReviewDate,
        lastReviewedAt,
      },
      select: {
        cardId: true,
        leitnerBox: true,
        correctStreak: true,
        wrongCount: true,
        isMastered: true,
        nextReviewDate: true,
        lastReviewedAt: true,
      },
    });

    return {
      cardId: row.cardId.toString(),
      leitnerBox: row.leitnerBox,
      correctStreak: row.correctStreak,
      wrongCount: row.wrongCount,
      isMastered: row.isMastered,
      nextReviewDate: row.nextReviewDate,
      lastReviewedAt: row.lastReviewedAt,
    };
  }

  private toCardDetail(row: CardRow): VocabularyCardDetail {
    return {
      id: row.id.toString(),
      topicId: row.topicId,
      word: row.word,
      pronunciationIpa: row.pronunciationIpa,
      partOfSpeech: row.partOfSpeech,
      englishDefinition: row.englishDefinition,
      bengaliMeaning: row.bengaliMeaning,
      synonyms: row.synonyms,
      antonyms: row.antonyms,
      mnemonicTrick: row.mnemonicTrick,
      exampleSentence: row.exampleSentence,
      audioPronounceUrl: row.audioPronounceUrl,
      difficulty: row.difficulty,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
