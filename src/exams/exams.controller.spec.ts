import { Test, type TestingModule } from '@nestjs/testing';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

const mockExamsService = {
  createExam: jest.fn(),
  assignQuestions: jest.fn(),
  publishExam: jest.fn(),
  listExams: jest.fn(),
  getExamBySlug: jest.fn(),
};

const EXAM_DETAIL = {
  id: '1',
  uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  categoryId: 1,
  tournamentId: null,
  title: 'October Mock Test',
  slug: 'october-mock-test',
  examType: 'LIVE_CENTRAL_TEST' as const,
  totalQuestions: 1,
  totalMarks: 1,
  passMarks: 0,
  durationMinutes: 60,
  negativeMarkingRate: 0.25,
  isOmrMode: true,
  shuffleQuestions: false,
  shuffleOptions: false,
  isPremiumOnly: false,
  allowMultipleRetakes: false,
  maxRetakesAllowed: 1,
  maxTabSwitchesAllowed: 3,
  syllabusDescription: null,
  studyMaterials: null,
  startTime: new Date(),
  endTime: new Date(),
  resultPublishTime: null,
  isPublished: false,
  isResultsPublished: false,
  totalParticipants: 0,
  highestScore: null,
  averageScore: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: [],
};

describe('ExamsController', () => {
  let controller: ExamsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamsController],
      providers: [{ provide: ExamsService, useValue: mockExamsService }],
    }).compile();

    controller = module.get<ExamsController>(ExamsController);
    jest.clearAllMocks();
  });

  it('createExam() delegates to the service', async () => {
    mockExamsService.createExam.mockResolvedValueOnce(EXAM_DETAIL);
    const dto = {
      title: 'October Mock Test',
      slug: 'october-mock-test',
      durationMinutes: 60,
      startTime: new Date(),
      endTime: new Date(),
    };

    const result = await controller.createExam(dto);

    expect(mockExamsService.createExam).toHaveBeenCalledWith(dto);
    expect(result.data.slug).toBe('october-mock-test');
  });

  it('assignQuestions() passes the numeric id and dto through', async () => {
    mockExamsService.assignQuestions.mockResolvedValueOnce(EXAM_DETAIL);
    const dto = {
      questions: [{ questionId: '501', marks: 1, negativeMarks: 0.25, questionOrder: 1 }],
    };

    await controller.assignQuestions(1n, dto);

    expect(mockExamsService.assignQuestions).toHaveBeenCalledWith(1n, dto);
  });

  it('publishExam() passes the numeric id through', async () => {
    mockExamsService.publishExam.mockResolvedValueOnce({ ...EXAM_DETAIL, isPublished: true });

    const result = await controller.publishExam(1n);

    expect(mockExamsService.publishExam).toHaveBeenCalledWith(1n);
    expect(result.data.isPublished).toBe(true);
  });

  it('listExams() forwards the parsed query and maps items to entities', async () => {
    mockExamsService.listExams.mockResolvedValueOnce({
      items: [
        {
          id: '1',
          categoryId: 1,
          title: 'October Mock Test',
          slug: 'october-mock-test',
          examType: 'LIVE_CENTRAL_TEST',
          totalQuestions: 1,
          totalMarks: 1,
          durationMinutes: 60,
          isPremiumOnly: false,
          startTime: new Date(),
          endTime: new Date(),
          status: 'live',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listExams({ page: 1, limit: 20 });

    expect(mockExamsService.listExams).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.data.items).toHaveLength(1);
  });

  it('getExamBySlug() forwards the slug through', async () => {
    mockExamsService.getExamBySlug.mockResolvedValueOnce(EXAM_DETAIL);

    const result = await controller.getExamBySlug('october-mock-test');

    expect(mockExamsService.getExamBySlug).toHaveBeenCalledWith('october-mock-test');
    expect(result.data.slug).toBe('october-mock-test');
  });
});
