import { Test, type TestingModule } from '@nestjs/testing';
import { CommunityService } from './community.service';
import { PrismaService } from '../database/prisma.service';

const mockTx = {
  questionCommentUpvote: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  questionComment: { update: jest.fn() },
};

const mockPrisma = {
  questionComment: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  questionReport: { create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
};

const COMMENT_ROW = {
  id: 1n,
  questionId: 501n,
  parentCommentId: null,
  commentText: 'Nice question',
  imageUrl: null,
  upvotes: 0,
  isPinned: false,
  isVerifiedByTeacher: false,
  isEdited: false,
  createdAt: new Date(),
  user: { id: 1, name: 'Alice', avatarUrl: null },
};

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    );
  });

  describe('listComments()', () => {
    it('fetches only top-level, non-deleted, non-hidden comments with their replies nested', async () => {
      mockPrisma.questionComment.findMany.mockResolvedValueOnce([{ ...COMMENT_ROW, replies: [] }]);

      await service.listComments(501n);

      expect(mockPrisma.questionComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { questionId: 501n, parentCommentId: null, deletedAt: null, isHidden: false },
        }),
      );
    });

    it('maps nested reply rows into the detail shape too', async () => {
      mockPrisma.questionComment.findMany.mockResolvedValueOnce([
        { ...COMMENT_ROW, replies: [{ ...COMMENT_ROW, id: 2n, parentCommentId: 1n }] },
      ]);

      const result = await service.listComments(501n);

      expect(result[0]?.replies).toEqual([
        expect.objectContaining({ id: '2', parentCommentId: '1' }),
      ]);
    });
  });

  describe('createComment()', () => {
    it('creates a top-level comment when no parentCommentId is given', async () => {
      mockPrisma.questionComment.create.mockResolvedValueOnce(COMMENT_ROW);

      await service.createComment(501n, 1, { commentText: 'Nice question' });

      expect(mockPrisma.questionComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentCommentId: null }),
        }),
      );
    });

    it('converts a provided parentCommentId to BigInt for a reply', async () => {
      mockPrisma.questionComment.create.mockResolvedValueOnce({
        ...COMMENT_ROW,
        parentCommentId: 9n,
      });

      await service.createComment(501n, 1, { commentText: 'I agree', parentCommentId: '9' });

      expect(mockPrisma.questionComment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ parentCommentId: 9n }) }),
      );
    });
  });

  describe('toggleUpvote()', () => {
    it('creates the upvote row and increments upvotes when none exists yet', async () => {
      mockTx.questionCommentUpvote.findUnique.mockResolvedValueOnce(null);
      mockTx.questionComment.update.mockResolvedValueOnce({ upvotes: 1 });

      const result = await service.toggleUpvote(1n, 1);

      expect(mockTx.questionCommentUpvote.create).toHaveBeenCalledWith({
        data: { commentId: 1n, userId: 1 },
      });
      expect(mockTx.questionComment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { upvotes: { increment: 1 } } }),
      );
      expect(result).toEqual({ upvoted: true, upvotes: 1 });
    });

    it('deletes the upvote row and decrements upvotes when one already exists', async () => {
      mockTx.questionCommentUpvote.findUnique.mockResolvedValueOnce({ commentId: 1n, userId: 1 });
      mockTx.questionComment.update.mockResolvedValueOnce({ upvotes: 0 });

      const result = await service.toggleUpvote(1n, 1);

      expect(mockTx.questionCommentUpvote.delete).toHaveBeenCalledWith({
        where: { commentId_userId: { commentId: 1n, userId: 1 } },
      });
      expect(mockTx.questionComment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { upvotes: { decrement: 1 } } }),
      );
      expect(result).toEqual({ upvoted: false, upvotes: 0 });
    });
  });

  describe('resolveReport()', () => {
    it('sets resolvedById, resolvedAt, and the requested status', async () => {
      mockPrisma.questionReport.update.mockResolvedValueOnce({
        id: 1n,
        questionId: 501n,
        userId: 1,
        resolvedById: 2,
        reason: 'WRONG_ANSWER',
        userNotes: null,
        screenshotUrl: null,
        resolutionNotes: 'Fixed',
        status: 'RESOLVED',
        createdAt: new Date(),
        resolvedAt: new Date(),
      });

      await service.resolveReport(1n, 2, { status: 'RESOLVED', resolutionNotes: 'Fixed' });

      expect(mockPrisma.questionReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolvedById: 2,
            resolutionNotes: 'Fixed',
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
