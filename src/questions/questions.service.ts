import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { CreatePassageDto } from './dto/create-passage.dto';
import { UpdateQuestionOptionDto } from './dto/create-question-option.dto';
import { QuestionDetail, PassageDetail } from './interfaces/question-detail.interface';
import { slugify } from './questions.utils';

type PrismaTransactionClient = Prisma.TransactionClient;

const QUESTION_DETAIL_SELECT = {
  id: true,
  uuid: true,
  topicId: true,
  passageId: true,
  createdById: true,
  verifiedById: true,
  questionText: true,
  questionImageUrl: true,
  textExplanation: true,
  explanationImageUrl: true,
  audioExplanationUrl: true,
  videoExplanationUrl: true,
  sourceReference: true,
  difficulty: true,
  isMultipleChoice: true,
  defaultMarks: true,
  defaultNegative: true,
  version: true,
  isFrozen: true,
  totalFacedCount: true,
  totalCorrectCount: true,
  totalSkippedCount: true,
  isVerified: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  options: {
    orderBy: { displayOrder: Prisma.SortOrder.asc },
    select: {
      id: true,
      optionLabel: true,
      optionText: true,
      optionImageUrl: true,
      isCorrect: true,
      displayOrder: true,
    },
  },
  questionTags: {
    select: { tag: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof QUESTION_DETAIL_SELECT }>;

const PASSAGE_SELECT = {
  id: true,
  title: true,
  passageText: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuestionPassageSelect;

type PassageRow = Prisma.QuestionPassageGetPayload<{ select: typeof PASSAGE_SELECT }>;

export interface QuestionListResult {
  items: QuestionDetail[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Questions ────────────────────────────────────────────────────────────

  async createQuestion(dto: CreateQuestionDto, createdById: number): Promise<QuestionDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          ...this.toQuestionScalarData(dto),
          createdById,
          options: { create: this.toOptionCreateData(dto.options) },
        },
        select: { id: true },
      });

      if (dto.tags && dto.tags.length > 0) {
        await this.linkTags(tx, created.id, dto.tags);
      }

      return tx.question.findUniqueOrThrow({
        where: { id: created.id },
        select: QUESTION_DETAIL_SELECT,
      });
    });

    return this.toQuestionDetail(row);
  }

  async bulkCreateQuestions(
    dto: BulkCreateQuestionsDto,
    createdById: number,
  ): Promise<{ count: number; questions: QuestionDetail[] }> {
    const rows = await this.prisma.$transaction(async (tx) => {
      // Resolve every tag across the whole batch in exactly two queries —
      // the one part of bulk-create that would otherwise be a genuine N+1
      // (or N*M) pattern across `dto.questions`.
      const allTagNames = dto.questions.flatMap((question) => question.tags ?? []);
      const tagIdByName = await this.resolveTagIds(tx, allTagNames);

      // Prisma has no bulk "createMany with nested relations" API, so each
      // question — with its own distinct set of options — is necessarily
      // its own create() call. This is O(n) parent-row creates by
      // construction (not a fixable N+1), bounded by MAX_BULK_QUESTIONS.
      const createdIds: bigint[] = [];
      const questionTagRows: Prisma.QuestionTagCreateManyInput[] = [];

      for (const question of dto.questions) {
        const created = await tx.question.create({
          data: {
            ...this.toQuestionScalarData(question),
            createdById,
            options: { create: this.toOptionCreateData(question.options) },
          },
          select: { id: true },
        });
        createdIds.push(created.id);

        for (const tagName of question.tags ?? []) {
          const tagId = tagIdByName.get(tagName);
          if (tagId !== undefined) {
            questionTagRows.push({ questionId: created.id, tagId });
          }
        }
      }

      if (questionTagRows.length > 0) {
        await tx.questionTag.createMany({ data: questionTagRows, skipDuplicates: true });
      }

      return tx.question.findMany({
        where: { id: { in: createdIds } },
        select: QUESTION_DETAIL_SELECT,
      });
    });

    return { count: rows.length, questions: rows.map((row) => this.toQuestionDetail(row)) };
  }

  async listQuestions(query: QueryQuestionsDto): Promise<QuestionListResult> {
    const where = this.buildQuestionsWhere(query);
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        select: QUESTION_DETAIL_SELECT,
        orderBy: { createdAt: Prisma.SortOrder.desc },
        skip,
        take: query.limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toQuestionDetail(row)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getQuestionById(id: bigint): Promise<QuestionDetail> {
    const row = await this.prisma.question.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: QUESTION_DETAIL_SELECT,
    });
    return this.toQuestionDetail(row);
  }

  async updateQuestion(
    id: bigint,
    dto: UpdateQuestionDto,
    actorId: number,
  ): Promise<QuestionDetail> {
    const existing = await this.prisma.question.findUniqueOrThrow({
      where: { id },
      select: { isFrozen: true, isMultipleChoice: true, questionText: true, version: true },
    });

    if (dto.options) {
      const resolvedIsMultipleChoice = dto.isMultipleChoice ?? existing.isMultipleChoice;
      const correctCount = dto.options.filter((option) => option.isCorrect).length;
      if (!resolvedIsMultipleChoice && correctCount !== 1) {
        throw new BadRequestException(
          'Single-choice questions must have exactly one correct option',
        );
      }
    }

    const touchesFrozenContent =
      existing.isFrozen && (dto.options !== undefined || dto.questionText !== undefined);

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.options !== undefined) {
        if (existing.isFrozen) {
          await this.reconcileFrozenOptions(tx, id, dto.options);
        } else {
          await tx.questionOption.deleteMany({ where: { questionId: id } });
          await tx.questionOption.createMany({ data: this.toOptionCreateData(dto.options, id) });
        }
      }

      if (dto.tags !== undefined) {
        await tx.questionTag.deleteMany({ where: { questionId: id } });
        if (dto.tags.length > 0) {
          await this.linkTags(tx, id, dto.tags);
        }
      }

      const { options: _options, tags: _tags, ...scalarUpdates } = dto;

      const updated = await tx.question.update({
        where: { id },
        data: {
          ...scalarUpdates,
          ...(touchesFrozenContent ? { version: { increment: 1 } } : {}),
        },
        select: QUESTION_DETAIL_SELECT,
      });

      if (touchesFrozenContent) {
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'QUESTION_FROZEN_CONTENT_UPDATED',
            entityType: 'Question',
            entityId: id.toString(),
            oldValues: { questionText: existing.questionText, version: existing.version },
            newValues: { questionText: updated.questionText, version: updated.version },
          },
        });
      }

      return updated;
    });

    return this.toQuestionDetail(row);
  }

  async deleteQuestion(id: bigint): Promise<void> {
    await this.prisma.question.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Passages ─────────────────────────────────────────────────────────────

  async createPassage(dto: CreatePassageDto): Promise<PassageDetail> {
    const row = await this.prisma.questionPassage.create({ data: dto, select: PASSAGE_SELECT });
    return this.toPassageDetail(row);
  }

  async getPassageById(id: bigint): Promise<PassageDetail> {
    const row = await this.prisma.questionPassage.findUniqueOrThrow({
      where: { id },
      select: PASSAGE_SELECT,
    });
    return this.toPassageDetail(row);
  }

  // ── Frozen-question option reconciliation ───────────────────────────────

  /**
   * Updates existing option rows in place and appends any brand-new ones.
   * Never deletes an existing row: a frozen question already has
   * `ExamQuestionRuntime` rows whose `selectedOptionId` FK is
   * `onDelete: Restrict`, so removing an option here would break referential
   * integrity for anyone who already answered it. Options are few per
   * question (never an unbounded collection), so the per-row update loop
   * below is a bounded, deliberate trade-off — Prisma's `updateMany` cannot
   * apply distinct values per row in a single call.
   */
  private async reconcileFrozenOptions(
    tx: PrismaTransactionClient,
    questionId: bigint,
    options: UpdateQuestionOptionDto[],
  ): Promise<void> {
    const newOptions: UpdateQuestionOptionDto[] = [];

    for (const option of options) {
      if (option.id === undefined) {
        newOptions.push(option);
        continue;
      }

      await tx.questionOption.update({
        where: { id_questionId: { id: BigInt(option.id), questionId } },
        data: {
          optionLabel: option.optionLabel,
          optionText: option.optionText,
          optionImageUrl: option.optionImageUrl,
          isCorrect: option.isCorrect,
          displayOrder: option.displayOrder,
        },
      });
    }

    if (newOptions.length > 0) {
      await tx.questionOption.createMany({
        data: this.toOptionCreateData(newOptions, questionId),
      });
    }
  }

  // ── Tag resolution (shared by create / bulk create / update) ───────────

  private async linkTags(
    tx: PrismaTransactionClient,
    questionId: bigint,
    tagNames: string[],
  ): Promise<void> {
    const tagIdByName = await this.resolveTagIds(tx, tagNames);
    const tagIds = Array.from(new Set(tagIdByName.values()));
    if (tagIds.length === 0) return;

    await tx.questionTag.createMany({
      data: tagIds.map((tagId) => ({ questionId, tagId })),
      skipDuplicates: true,
    });
  }

  /**
   * Resolves free-text tag names to `Tag.id`s in exactly two queries,
   * regardless of how many names are given: a `createMany` (skipping ones
   * that already exist by name or slug) followed by one `findMany`. Avoids
   * the N+1 "find-or-create per tag" pattern a naive per-tag loop would fall
   * into.
   */
  private async resolveTagIds(
    tx: PrismaTransactionClient,
    tagNames: string[],
  ): Promise<Map<string, number>> {
    const uniqueNames = Array.from(new Set(tagNames.map((name) => name.trim()).filter(Boolean)));
    if (uniqueNames.length === 0) return new Map();

    const nameBySlug = new Map(uniqueNames.map((name) => [slugify(name), name]));

    await tx.tag.createMany({
      data: uniqueNames.map((name) => ({ name, slug: slugify(name) })),
      skipDuplicates: true,
    });

    const rows = await tx.tag.findMany({
      where: { slug: { in: Array.from(nameBySlug.keys()) } },
      select: { id: true, slug: true },
    });

    const idByName = new Map<string, number>();
    for (const row of rows) {
      const name = nameBySlug.get(row.slug);
      if (name !== undefined) idByName.set(name, row.id);
    }
    return idByName;
  }

  // ── Query building ───────────────────────────────────────────────────────

  private buildQuestionsWhere(query: QueryQuestionsDto): Prisma.QuestionWhereInput {
    const topicFilter: Prisma.TopicWhereInput = {};
    if (query.subjectId !== undefined) topicFilter.subjectId = query.subjectId;
    if (query.categoryId !== undefined) topicFilter.subject = { categoryId: query.categoryId };

    const searchQuery = query.q !== undefined ? this.toTsQuery(query.q) : undefined;

    return {
      deletedAt: null,
      ...(query.topicId !== undefined ? { topicId: query.topicId } : {}),
      ...(Object.keys(topicFilter).length > 0 ? { topic: topicFilter } : {}),
      ...(query.difficulty !== undefined ? { difficulty: query.difficulty } : {}),
      ...(query.tagSlug !== undefined
        ? { questionTags: { some: { tag: { slug: query.tagSlug } } } }
        : {}),
      ...(query.isVerified !== undefined ? { isVerified: query.isVerified } : {}),
      ...(searchQuery ? { questionText: { search: searchQuery } } : {}),
    };
  }

  /** Converts free-text input into a Postgres tsquery string (AND-joined
   * words), stripping tsquery operator characters so user input can never
   * produce invalid or unintended query syntax. */
  private toTsQuery(q: string): string | undefined {
    const words = q
      .split(/\s+/)
      .map((word) => word.replace(/[&|!():*]/g, ''))
      .filter((word) => word.length > 0);

    return words.length > 0 ? words.join(' & ') : undefined;
  }

  // ── Mapping helpers ──────────────────────────────────────────────────────

  private toQuestionScalarData(
    dto: CreateQuestionDto,
  ): Omit<Prisma.QuestionUncheckedCreateInput, 'createdById' | 'options'> {
    return {
      topicId: dto.topicId,
      passageId: dto.passageId,
      questionText: dto.questionText,
      questionImageUrl: dto.questionImageUrl,
      textExplanation: dto.textExplanation,
      explanationImageUrl: dto.explanationImageUrl,
      audioExplanationUrl: dto.audioExplanationUrl,
      videoExplanationUrl: dto.videoExplanationUrl,
      sourceReference: dto.sourceReference,
      difficulty: dto.difficulty,
      isMultipleChoice: dto.isMultipleChoice,
      defaultMarks: dto.defaultMarks,
      defaultNegative: dto.defaultNegative,
    };
  }

  private toOptionCreateData(
    options: {
      optionLabel: string;
      optionText: string;
      optionImageUrl?: string;
      isCorrect: boolean;
      displayOrder?: number;
    }[],
    questionId?: bigint,
  ): Prisma.QuestionOptionUncheckedCreateInput[] {
    return options.map((option, index) => ({
      ...(questionId !== undefined ? { questionId } : {}),
      optionLabel: option.optionLabel,
      optionText: option.optionText,
      optionImageUrl: option.optionImageUrl,
      isCorrect: option.isCorrect,
      // Default to 1-based array position rather than a flat `1` for every
      // option — omitting displayOrder should preserve the order the client
      // sent the options in, not collapse them all to the same value.
      displayOrder: option.displayOrder ?? index + 1,
    })) as Prisma.QuestionOptionUncheckedCreateInput[];
  }

  private toQuestionDetail(row: QuestionRow): QuestionDetail {
    return {
      id: row.id.toString(),
      uuid: row.uuid,
      topicId: row.topicId,
      passageId: row.passageId?.toString() ?? null,
      createdById: row.createdById,
      verifiedById: row.verifiedById,
      questionText: row.questionText,
      questionImageUrl: row.questionImageUrl,
      textExplanation: row.textExplanation,
      explanationImageUrl: row.explanationImageUrl,
      audioExplanationUrl: row.audioExplanationUrl,
      videoExplanationUrl: row.videoExplanationUrl,
      sourceReference: row.sourceReference,
      difficulty: row.difficulty,
      isMultipleChoice: row.isMultipleChoice,
      defaultMarks: row.defaultMarks.toNumber(),
      defaultNegative: row.defaultNegative.toNumber(),
      version: row.version,
      isFrozen: row.isFrozen,
      totalFacedCount: row.totalFacedCount,
      totalCorrectCount: row.totalCorrectCount,
      totalSkippedCount: row.totalSkippedCount,
      isVerified: row.isVerified,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      options: row.options.map((option) => ({
        id: option.id.toString(),
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
      tags: row.questionTags.map(({ tag }) => tag),
    };
  }

  private toPassageDetail(row: PassageRow): PassageDetail {
    return {
      id: row.id.toString(),
      title: row.title,
      passageText: row.passageText,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
