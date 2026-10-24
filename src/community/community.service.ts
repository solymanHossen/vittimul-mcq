import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { CommentDetail, ReportDetail } from './interfaces/community.interface';

const COMMENT_SELECT = {
  id: true,
  questionId: true,
  parentCommentId: true,
  commentText: true,
  imageUrl: true,
  upvotes: true,
  isPinned: true,
  isVerifiedByTeacher: true,
  isEdited: true,
  createdAt: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.QuestionCommentSelect;

type CommentRow = Prisma.QuestionCommentGetPayload<{ select: typeof COMMENT_SELECT }>;

const REPLY_SELECT = {
  ...COMMENT_SELECT,
} satisfies Prisma.QuestionCommentSelect;

const REPORT_SELECT = {
  id: true,
  questionId: true,
  userId: true,
  resolvedById: true,
  reason: true,
  userNotes: true,
  screenshotUrl: true,
  resolutionNotes: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
} satisfies Prisma.QuestionReportSelect;

type ReportRow = Prisma.QuestionReportGetPayload<{ select: typeof REPORT_SELECT }>;

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Comments ─────────────────────────────────────────────────────────────

  async listComments(questionId: bigint): Promise<CommentDetail[]> {
    const rows = await this.prisma.questionComment.findMany({
      where: { questionId, parentCommentId: null, deletedAt: null, isHidden: false },
      orderBy: [{ isPinned: 'desc' }, { upvotes: 'desc' }, { createdAt: 'desc' }],
      select: {
        ...COMMENT_SELECT,
        replies: {
          where: { deletedAt: null, isHidden: false },
          orderBy: { createdAt: 'asc' },
          select: REPLY_SELECT,
        },
      },
    });

    return rows.map((row) => this.toCommentDetail(row, row.replies));
  }

  async createComment(
    questionId: bigint,
    userId: number,
    dto: CreateCommentDto,
  ): Promise<CommentDetail> {
    const row = await this.prisma.questionComment.create({
      data: {
        questionId,
        userId,
        commentText: dto.commentText,
        imageUrl: dto.imageUrl,
        parentCommentId: dto.parentCommentId ? BigInt(dto.parentCommentId) : null,
      },
      select: COMMENT_SELECT,
    });

    return this.toCommentDetail(row, []);
  }

  /**
   * Toggles the current user's upvote inside one transaction: the
   * `QuestionCommentUpvote` composite-key row is the de-duplication guard
   * (`@@id([commentId, userId])`), and `QuestionComment.upvotes` is kept in
   * sync atomically alongside it.
   */
  async toggleUpvote(
    commentId: bigint,
    userId: number,
  ): Promise<{ upvoted: boolean; upvotes: number }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.questionCommentUpvote.findUnique({
        where: { commentId_userId: { commentId, userId } },
      });

      if (existing) {
        await tx.questionCommentUpvote.delete({
          where: { commentId_userId: { commentId, userId } },
        });
        const comment = await tx.questionComment.update({
          where: { id: commentId },
          data: { upvotes: { decrement: 1 } },
          select: { upvotes: true },
        });
        return { upvoted: false, upvotes: comment.upvotes };
      }

      await tx.questionCommentUpvote.create({ data: { commentId, userId } });
      const comment = await tx.questionComment.update({
        where: { id: commentId },
        data: { upvotes: { increment: 1 } },
        select: { upvotes: true },
      });
      return { upvoted: true, upvotes: comment.upvotes };
    });
  }

  async verifyComment(commentId: bigint): Promise<CommentDetail> {
    const row = await this.prisma.questionComment.update({
      where: { id: commentId },
      data: { isVerifiedByTeacher: true },
      select: COMMENT_SELECT,
    });
    return this.toCommentDetail(row, []);
  }

  // ── Reports ──────────────────────────────────────────────────────────────

  async createReport(
    questionId: bigint,
    userId: number,
    dto: CreateReportDto,
  ): Promise<ReportDetail> {
    const row = await this.prisma.questionReport.create({
      data: {
        questionId,
        userId,
        reason: dto.reason,
        userNotes: dto.userNotes,
        screenshotUrl: dto.screenshotUrl,
      },
      select: REPORT_SELECT,
    });
    return this.toReportDetail(row);
  }

  async resolveReport(
    reportId: bigint,
    resolvedById: number,
    dto: ResolveReportDto,
  ): Promise<ReportDetail> {
    const row = await this.prisma.questionReport.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolvedById,
        resolutionNotes: dto.resolutionNotes,
        resolvedAt: new Date(),
      },
      select: REPORT_SELECT,
    });
    return this.toReportDetail(row);
  }

  // ── Mapping ──────────────────────────────────────────────────────────────

  private toCommentDetail(row: CommentRow, replies: CommentRow[]): CommentDetail {
    return {
      id: row.id.toString(),
      questionId: row.questionId.toString(),
      parentCommentId: row.parentCommentId?.toString() ?? null,
      commentText: row.commentText,
      imageUrl: row.imageUrl,
      upvotes: row.upvotes,
      isPinned: row.isPinned,
      isVerifiedByTeacher: row.isVerifiedByTeacher,
      isEdited: row.isEdited,
      createdAt: row.createdAt,
      author: row.user,
      replies: replies.map((reply) => this.toCommentDetail(reply, [])),
    };
  }

  private toReportDetail(row: ReportRow): ReportDetail {
    return {
      id: row.id.toString(),
      questionId: row.questionId.toString(),
      userId: row.userId,
      resolvedById: row.resolvedById,
      reason: row.reason,
      userNotes: row.userNotes,
      screenshotUrl: row.screenshotUrl,
      resolutionNotes: row.resolutionNotes,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    };
  }
}
