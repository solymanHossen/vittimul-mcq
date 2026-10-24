import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockCommunityService = {
  listComments: jest.fn(),
  createComment: jest.fn(),
  toggleUpvote: jest.fn(),
  verifyComment: jest.fn(),
  createReport: jest.fn(),
  resolveReport: jest.fn(),
};

const user: AuthUser = { id: 1, email: 'user@example.com', role: Role.USER, isActive: true };

const COMMENT = {
  id: '1',
  questionId: '501',
  parentCommentId: null,
  commentText: 'Nice question',
  imageUrl: null,
  upvotes: 0,
  isPinned: false,
  isVerifiedByTeacher: false,
  isEdited: false,
  createdAt: new Date(),
  author: { id: 1, name: 'Alice', avatarUrl: null },
  replies: [],
};

describe('CommunityController', () => {
  let controller: CommunityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [{ provide: CommunityService, useValue: mockCommunityService }],
    }).compile();

    controller = module.get<CommunityController>(CommunityController);
    jest.clearAllMocks();
  });

  it('listComments() forwards the bigint questionId', async () => {
    mockCommunityService.listComments.mockResolvedValueOnce([COMMENT]);

    const result = await controller.listComments(501n);

    expect(mockCommunityService.listComments).toHaveBeenCalledWith(501n);
    expect(result.data).toHaveLength(1);
  });

  it('createComment() forwards questionId, dto, and current user id', async () => {
    mockCommunityService.createComment.mockResolvedValueOnce(COMMENT);
    const dto = { commentText: 'Nice question' };

    await controller.createComment(501n, dto, user);

    expect(mockCommunityService.createComment).toHaveBeenCalledWith(501n, 1, dto);
  });

  it('toggleUpvote() reflects the result in the response message', async () => {
    mockCommunityService.toggleUpvote.mockResolvedValueOnce({ upvoted: true, upvotes: 1 });

    const result = await controller.toggleUpvote(1n, user);

    expect(mockCommunityService.toggleUpvote).toHaveBeenCalledWith(1n, 1);
    expect(result.message).toBe('Comment upvoted');
  });

  it('resolveReport() forwards reportId, dto, and the resolving user id', async () => {
    mockCommunityService.resolveReport.mockResolvedValueOnce({
      id: '1',
      questionId: '501',
      userId: 1,
      resolvedById: 2,
      reason: 'WRONG_ANSWER',
      userNotes: null,
      screenshotUrl: null,
      resolutionNotes: null,
      status: 'RESOLVED',
      createdAt: new Date(),
      resolvedAt: new Date(),
    });
    const resolver: AuthUser = {
      id: 2,
      email: 'mod@example.com',
      role: Role.MODERATOR,
      isActive: true,
    };

    await controller.resolveReport(1n, { status: 'RESOLVED' }, resolver);

    expect(mockCommunityService.resolveReport).toHaveBeenCalledWith(1n, 2, { status: 'RESOLVED' });
  });
});
