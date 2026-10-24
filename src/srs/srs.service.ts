import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { startOfUtcDay } from '../common/utils/date.util';
import { applySm2 } from './sm2.util';
import { ReviewQuestionDto } from './dto/review-question.dto';
import { UpsertFavoriteDto } from './dto/upsert-favorite.dto';
import { DueQuestion, FavoriteDetail, SrsReviewResult } from './interfaces/srs.interface';

@Injectable()
export class SrsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDueQuestions(userId: number): Promise<DueQuestion[]> {
    const today = startOfUtcDay(new Date());

    const rows = await this.prisma.spacedRepetitionQueue.findMany({
      where: { userId, isMastered: false, nextReviewDate: { lte: today } },
      orderBy: { nextReviewDate: 'asc' },
      select: {
        repetitionNumber: true,
        intervalDays: true,
        easeFactor: true,
        nextReviewDate: true,
        question: {
          select: {
            id: true,
            questionText: true,
            questionImageUrl: true,
            textExplanation: true,
            explanationImageUrl: true,
            difficulty: true,
            isMultipleChoice: true,
            options: {
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true,
                optionLabel: true,
                optionText: true,
                optionImageUrl: true,
                isCorrect: true,
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      questionId: row.question.id.toString(),
      questionText: row.question.questionText,
      questionImageUrl: row.question.questionImageUrl,
      textExplanation: row.question.textExplanation,
      explanationImageUrl: row.question.explanationImageUrl,
      difficulty: row.question.difficulty,
      isMultipleChoice: row.question.isMultipleChoice,
      options: row.question.options.map((option) => ({
        id: option.id.toString(),
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
        isCorrect: option.isCorrect,
      })),
      repetitionNumber: row.repetitionNumber,
      intervalDays: row.intervalDays,
      easeFactor: row.easeFactor.toNumber(),
      nextReviewDate: row.nextReviewDate,
    }));
  }

  async reviewQuestion(userId: number, dto: ReviewQuestionDto): Promise<SrsReviewResult> {
    const questionId = BigInt(dto.questionId);
    const today = startOfUtcDay(new Date());

    const existing = await this.prisma.spacedRepetitionQueue.findUnique({
      where: { userId_questionId: { userId, questionId } },
      select: { repetitionNumber: true, easeFactor: true, intervalDays: true },
    });

    const current = {
      repetitionNumber: existing?.repetitionNumber ?? 0,
      easeFactor: existing?.easeFactor.toNumber() ?? 2.5,
      intervalDays: existing?.intervalDays ?? 1,
    };
    const result = applySm2(current, dto.qualityGrade);
    const nextReviewDate = new Date(today.getTime() + result.intervalDays * 86_400_000);
    const lastReviewedAt = new Date();

    const row = await this.prisma.spacedRepetitionQueue.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: {
        userId,
        questionId,
        repetitionNumber: result.repetitionNumber,
        lapsesCount: result.lapsesIncrement,
        intervalDays: result.intervalDays,
        easeFactor: result.easeFactor,
        lastQualityGrade: dto.qualityGrade,
        nextReviewDate,
        isMastered: result.isMastered,
        lastReviewedAt,
      },
      update: {
        repetitionNumber: result.repetitionNumber,
        lapsesCount: { increment: result.lapsesIncrement },
        intervalDays: result.intervalDays,
        easeFactor: result.easeFactor,
        lastQualityGrade: dto.qualityGrade,
        nextReviewDate,
        isMastered: result.isMastered,
        lastReviewedAt,
      },
      select: {
        questionId: true,
        repetitionNumber: true,
        lapsesCount: true,
        intervalDays: true,
        easeFactor: true,
        nextReviewDate: true,
        isMastered: true,
        lastReviewedAt: true,
      },
    });

    return {
      questionId: row.questionId.toString(),
      repetitionNumber: row.repetitionNumber,
      lapsesCount: row.lapsesCount,
      intervalDays: row.intervalDays,
      easeFactor: row.easeFactor.toNumber(),
      nextReviewDate: row.nextReviewDate,
      isMastered: row.isMastered,
      lastReviewedAt: row.lastReviewedAt,
    };
  }

  async upsertFavorite(userId: number, dto: UpsertFavoriteDto): Promise<FavoriteDetail> {
    const questionId = BigInt(dto.questionId);

    const row = await this.prisma.userFavorite.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: {
        userId,
        questionId,
        folderName: dto.folderName ?? 'Default',
        personalNote: dto.personalNote,
      },
      update: {
        folderName: dto.folderName ?? 'Default',
        personalNote: dto.personalNote,
      },
      select: {
        questionId: true,
        folderName: true,
        personalNote: true,
        createdAt: true,
        question: { select: { questionText: true } },
      },
    });

    return this.toFavoriteDetail(row);
  }

  async listFavorites(userId: number): Promise<FavoriteDetail[]> {
    const rows = await this.prisma.userFavorite.findMany({
      where: { userId },
      orderBy: [{ folderName: 'asc' }, { createdAt: 'desc' }],
      select: {
        questionId: true,
        folderName: true,
        personalNote: true,
        createdAt: true,
        question: { select: { questionText: true } },
      },
    });

    return rows.map((row) => this.toFavoriteDetail(row));
  }

  async deleteFavorite(userId: number, questionId: bigint): Promise<void> {
    await this.prisma.userFavorite.delete({ where: { userId_questionId: { userId, questionId } } });
  }

  private toFavoriteDetail(row: {
    questionId: bigint;
    folderName: string;
    personalNote: string | null;
    createdAt: Date;
    question: { questionText: string };
  }): FavoriteDetail {
    return {
      questionId: row.questionId.toString(),
      folderName: row.folderName,
      personalNote: row.personalNote,
      createdAt: row.createdAt,
      questionText: row.question.questionText,
    };
  }
}
