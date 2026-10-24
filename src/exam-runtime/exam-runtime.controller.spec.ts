import { Test, type TestingModule } from '@nestjs/testing';
import { AttemptStatus, QuestionNavState, Role } from '@prisma/client';
import { ExamRuntimeController } from './exam-runtime.controller';
import { ExamRuntimeService } from './exam-runtime.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockExamRuntimeService = {
  startAttempt: jest.fn(),
  syncAnswers: jest.fn(),
  recordAntiCheatEvent: jest.fn(),
  submitAttempt: jest.fn(),
};

const currentUser: AuthUser = { id: 1, email: 'user@example.com', role: Role.USER, isActive: true };

describe('ExamRuntimeController', () => {
  let controller: ExamRuntimeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamRuntimeController],
      providers: [{ provide: ExamRuntimeService, useValue: mockExamRuntimeService }],
    }).compile();

    controller = module.get<ExamRuntimeController>(ExamRuntimeController);
    jest.clearAllMocks();
  });

  it('startAttempt() forwards examId and the current user id', async () => {
    mockExamRuntimeService.startAttempt.mockResolvedValueOnce({
      attempt: {
        id: 'attempt-1',
        examId: '1',
        attemptNumber: 1,
        isOfficial: true,
        isPracticeArchive: false,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(),
      },
      questions: [],
    });

    const result = await controller.startAttempt(1n, currentUser);

    expect(mockExamRuntimeService.startAttempt).toHaveBeenCalledWith(1n, 1);
    expect(result.data.attempt.id).toBe('attempt-1');
  });

  it('syncAnswers() forwards attemptId, dto, and the current user id', async () => {
    mockExamRuntimeService.syncAnswers.mockResolvedValueOnce({ synced: 2 });
    const dto = {
      answers: [{ questionId: '1', navState: QuestionNavState.ANSWERED, timeSpentSeconds: 5 }],
    };

    const result = await controller.syncAnswers('attempt-1', dto, currentUser);

    expect(mockExamRuntimeService.syncAnswers).toHaveBeenCalledWith('attempt-1', 1, dto);
    expect(result.data.synced).toBe(2);
  });

  it('recordAntiCheatEvent() reflects disqualification in the response message', async () => {
    mockExamRuntimeService.recordAntiCheatEvent.mockResolvedValueOnce({ disqualified: true });

    const result = await controller.recordAntiCheatEvent(
      'attempt-1',
      { eventName: 'TAB_SWITCH', severity: 'HIGH' },
      currentUser,
    );

    expect(result.message).toContain('disqualified');
    expect(result.data.disqualified).toBe(true);
  });

  it('submitAttempt() forwards attemptId and the current user id', async () => {
    mockExamRuntimeService.submitAttempt.mockResolvedValueOnce({
      id: 'attempt-1',
      examId: '1',
      status: AttemptStatus.EVALUATED,
      submittedAt: new Date(),
      evaluatedAt: new Date(),
      totalAnswered: 1,
      totalCorrect: 1,
      totalWrong: 0,
      totalUnanswered: 0,
      rawPositiveMarks: 1,
      negativeDeducted: 0,
      obtainedScore: 1,
      accuracyRate: 100,
      isPassed: true,
      timeTakenSeconds: 60,
      subjectWiseBreakdown: [],
    });

    const result = await controller.submitAttempt('attempt-1', currentUser);

    expect(mockExamRuntimeService.submitAttempt).toHaveBeenCalledWith('attempt-1', 1);
    expect(result.data.obtainedScore).toBe(1);
  });
});
