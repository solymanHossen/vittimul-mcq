import { Test, type TestingModule } from '@nestjs/testing';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../database/prisma.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

const mockPrisma = {
  tournament: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirstOrThrow: jest.fn(),
  },
  tournamentRanking: { findMany: jest.fn(), count: jest.fn() },
};

const TOURNAMENT_ROW = {
  id: 1,
  seasonName: 'October Championship',
  slug: 'october-championship',
  description: null,
  bannerUrl: null,
  startsAt: new Date(),
  endsAt: new Date(),
  prizePoolMeta: null,
  rulesMeta: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TournamentsService', () => {
  let service: TournamentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TournamentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    jest.clearAllMocks();
  });

  it('createTournament() delegates to the service', async () => {
    mockPrisma.tournament.create.mockResolvedValueOnce(TOURNAMENT_ROW);

    const result = await service.createTournament({
      seasonName: 'October Championship',
      slug: 'october-championship',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86_400_000),
    });

    expect(result.slug).toBe('october-championship');
  });

  it('getStandings() ranks by cumulativeScore desc, totalTimeSeconds asc and computes 1-based rank with offset', async () => {
    mockPrisma.tournament.findFirstOrThrow.mockResolvedValueOnce({ id: 1 });
    mockPrisma.tournamentRanking.findMany.mockResolvedValueOnce([
      {
        userId: 7,
        examsParticipated: 3,
        cumulativeScore: decimal(250.5),
        totalTimeSeconds: 5400,
        finalRank: null,
        user: { name: 'Alice', institutionName: null, avatarUrl: null },
      },
    ]);
    mockPrisma.tournamentRanking.count.mockResolvedValueOnce(21);

    const result = await service.getStandings('october-championship', { page: 2, limit: 20 });

    expect(mockPrisma.tournamentRanking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 1 },
        orderBy: [{ cumulativeScore: 'desc' }, { totalTimeSeconds: 'asc' }],
        skip: 20,
        take: 20,
      }),
    );
    expect(result.items[0]).toMatchObject({ rank: 21, userId: 7, cumulativeScore: 250.5 });
  });
});
