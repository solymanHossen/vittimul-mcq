import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ExamRuntimeService } from '../exam-runtime/exam-runtime.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { AssignQuestionsDto } from './dto/assign-questions.dto';
import { QueryExamsDto } from './dto/query-exams.dto';
import { ExamDetail, ExamStatus, ExamSummary, PaginatedExams } from './interfaces/exam.interface';

const EXAM_DETAIL_SELECT = {
  id: true,
  uuid: true,
  categoryId: true,
  tournamentId: true,
  title: true,
  slug: true,
  examType: true,
  totalQuestions: true,
  totalMarks: true,
  passMarks: true,
  durationMinutes: true,
  negativeMarkingRate: true,
  isOmrMode: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  isPremiumOnly: true,
  allowMultipleRetakes: true,
  maxRetakesAllowed: true,
  maxTabSwitchesAllowed: true,
  syllabusDescription: true,
  studyMaterials: true,
  startTime: true,
  endTime: true,
  resultPublishTime: true,
  isPublished: true,
  isResultsPublished: true,
  totalParticipants: true,
  highestScore: true,
  averageScore: true,
  createdAt: true,
  updatedAt: true,
  sections: {
    orderBy: { displayOrder: Prisma.SortOrder.asc },
    select: {
      id: true,
      subjectId: true,
      title: true,
      displayOrder: true,
      totalMarks: true,
      sectionalCutoff: true,
      durationMinutes: true,
    },
  },
  // Deliberately excludes `accessPin` — never expose it via any read path.
} satisfies Prisma.ExamSelect;

type ExamRow = Prisma.ExamGetPayload<{ select: typeof EXAM_DETAIL_SELECT }>;

const EXAM_SUMMARY_SELECT = {
  id: true,
  categoryId: true,
  title: true,
  slug: true,
  examType: true,
  totalQuestions: true,
  totalMarks: true,
  durationMinutes: true,
  isPremiumOnly: true,
  startTime: true,
  endTime: true,
} satisfies Prisma.ExamSelect;

type ExamSummaryRow = Prisma.ExamGetPayload<{ select: typeof EXAM_SUMMARY_SELECT }>;

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examRuntimeService: ExamRuntimeService,
  ) {}

  async createExam(dto: CreateExamDto): Promise<ExamDetail> {
    const exam = await this.prisma.exam.create({
      data: {
        categoryId: dto.categoryId,
        tournamentId: dto.tournamentId,
        title: dto.title,
        slug: dto.slug,
        examType: dto.examType,
        durationMinutes: dto.durationMinutes,
        negativeMarkingRate: dto.negativeMarkingRate,
        isOmrMode: dto.isOmrMode,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
        isPremiumOnly: dto.isPremiumOnly,
        allowMultipleRetakes: dto.allowMultipleRetakes,
        maxRetakesAllowed: dto.maxRetakesAllowed,
        maxTabSwitchesAllowed: dto.maxTabSwitchesAllowed,
        accessPin: dto.accessPin,
        syllabusDescription: dto.syllabusDescription,
        studyMaterials: dto.studyMaterials as Prisma.InputJsonValue | undefined,
        startTime: dto.startTime,
        endTime: dto.endTime,
        resultPublishTime: dto.resultPublishTime,
        passMarks: dto.passMarks ?? 0,
        // No Prisma default exists for totalMarks (it's computed as
        // questions are assigned via assignQuestions) — must be seeded
        // explicitly at creation.
        totalMarks: 0,
        sections: dto.sections
          ? {
              create: dto.sections.map((section) => ({
                subjectId: section.subjectId,
                title: section.title,
                displayOrder: section.displayOrder ?? 1,
                sectionalCutoff: section.sectionalCutoff,
                durationMinutes: section.durationMinutes,
              })),
            }
          : undefined,
      },
      select: EXAM_DETAIL_SELECT,
    });

    return this.toExamDetail(exam);
  }

  /**
   * Assigns questions to the exam inside one transaction: bulk-links them via
   * `createMany`, accumulates `Exam.totalMarks`/`totalQuestions` and each
   * touched section's `totalMarks` with `increment` (so calling this
   * multiple times in batches is safe), and freezes every assigned question
   * in a single `updateMany` — never a per-question loop.
   */
  async assignQuestions(examId: bigint, dto: AssignQuestionsDto): Promise<ExamDetail> {
    const totalMarksToAdd = dto.questions.reduce((sum, q) => sum + q.marks, 0);
    const sectionMarks = new Map<string, number>();
    for (const question of dto.questions) {
      if (question.sectionId) {
        sectionMarks.set(
          question.sectionId,
          (sectionMarks.get(question.sectionId) ?? 0) + question.marks,
        );
      }
    }

    const exam = await this.prisma.$transaction(async (tx) => {
      await tx.examQuestion.createMany({
        data: dto.questions.map((question) => ({
          examId,
          questionId: BigInt(question.questionId),
          sectionId: question.sectionId ? BigInt(question.sectionId) : null,
          marks: question.marks,
          negativeMarks: question.negativeMarks,
          questionOrder: question.questionOrder,
        })),
      });

      await tx.exam.update({
        where: { id: examId },
        data: {
          totalQuestions: { increment: dto.questions.length },
          totalMarks: { increment: totalMarksToAdd },
        },
      });

      // Bounded by the number of distinct sections referenced in this
      // request (always small) — not a per-question loop.
      for (const [sectionId, marksSum] of sectionMarks) {
        await tx.examSection.update({
          where: { id: BigInt(sectionId) },
          data: { totalMarks: { increment: marksSum } },
        });
      }

      await tx.question.updateMany({
        where: { id: { in: dto.questions.map((question) => BigInt(question.questionId)) } },
        data: { isFrozen: true },
      });

      return tx.exam.findUniqueOrThrow({ where: { id: examId }, select: EXAM_DETAIL_SELECT });
    });

    return this.toExamDetail(exam);
  }

  async publishExam(examId: bigint): Promise<ExamDetail> {
    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { totalQuestions: true, totalMarks: true },
    });

    if (exam.totalQuestions < 1) {
      throw new BadRequestException('Exam must have at least one question before publishing');
    }
    if (exam.totalMarks.toNumber() <= 0) {
      throw new BadRequestException('Exam total marks must be greater than zero before publishing');
    }

    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: { isPublished: true },
      select: EXAM_DETAIL_SELECT,
    });

    await this.examRuntimeService.warmExamPaperCache(examId);

    return this.toExamDetail(updated);
  }

  async listExams(query: QueryExamsDto): Promise<PaginatedExams> {
    const now = new Date();
    const where: Prisma.ExamWhereInput = {
      isPublished: true,
      deletedAt: null,
      ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
      ...(query.examType !== undefined ? { examType: query.examType } : {}),
      ...(query.status === 'upcoming' ? { startTime: { gt: now } } : {}),
      ...(query.status === 'live' ? { startTime: { lte: now }, endTime: { gte: now } } : {}),
      ...(query.status === 'archived' ? { endTime: { lt: now } } : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        select: EXAM_SUMMARY_SELECT,
        orderBy: { startTime: Prisma.SortOrder.desc },
        skip,
        take: query.limit,
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toExamSummary(row, now)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getExamBySlug(slug: string): Promise<ExamDetail> {
    const exam = await this.prisma.exam.findFirstOrThrow({
      where: { slug, isPublished: true, deletedAt: null },
      select: EXAM_DETAIL_SELECT,
    });
    return this.toExamDetail(exam);
  }

  private toExamSummary(row: ExamSummaryRow, now: Date): ExamSummary {
    return {
      id: row.id.toString(),
      categoryId: row.categoryId,
      title: row.title,
      slug: row.slug,
      examType: row.examType,
      totalQuestions: row.totalQuestions,
      totalMarks: row.totalMarks.toNumber(),
      durationMinutes: row.durationMinutes,
      isPremiumOnly: row.isPremiumOnly,
      startTime: row.startTime,
      endTime: row.endTime,
      status: this.computeStatus(row.startTime, row.endTime, now),
    };
  }

  private computeStatus(startTime: Date, endTime: Date, now: Date): ExamStatus {
    if (now < startTime) return 'upcoming';
    if (now > endTime) return 'archived';
    return 'live';
  }

  private toExamDetail(row: ExamRow): ExamDetail {
    return {
      id: row.id.toString(),
      uuid: row.uuid,
      categoryId: row.categoryId,
      tournamentId: row.tournamentId,
      title: row.title,
      slug: row.slug,
      examType: row.examType,
      totalQuestions: row.totalQuestions,
      totalMarks: row.totalMarks.toNumber(),
      passMarks: row.passMarks.toNumber(),
      durationMinutes: row.durationMinutes,
      negativeMarkingRate: row.negativeMarkingRate.toNumber(),
      isOmrMode: row.isOmrMode,
      shuffleQuestions: row.shuffleQuestions,
      shuffleOptions: row.shuffleOptions,
      isPremiumOnly: row.isPremiumOnly,
      allowMultipleRetakes: row.allowMultipleRetakes,
      maxRetakesAllowed: row.maxRetakesAllowed,
      maxTabSwitchesAllowed: row.maxTabSwitchesAllowed,
      syllabusDescription: row.syllabusDescription,
      studyMaterials: row.studyMaterials,
      startTime: row.startTime,
      endTime: row.endTime,
      resultPublishTime: row.resultPublishTime,
      isPublished: row.isPublished,
      isResultsPublished: row.isResultsPublished,
      totalParticipants: row.totalParticipants,
      highestScore: row.highestScore?.toNumber() ?? null,
      averageScore: row.averageScore?.toNumber() ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sections: row.sections.map((section) => ({
        id: section.id.toString(),
        subjectId: section.subjectId,
        title: section.title,
        displayOrder: section.displayOrder,
        totalMarks: section.totalMarks.toNumber(),
        sectionalCutoff: section.sectionalCutoff?.toNumber() ?? null,
        durationMinutes: section.durationMinutes,
      })),
    };
  }
}
