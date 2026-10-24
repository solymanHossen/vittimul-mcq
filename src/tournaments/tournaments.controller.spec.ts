import { Test, type TestingModule } from '@nestjs/testing';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

const mockTournamentsService = {
  createTournament: jest.fn(),
  listTournaments: jest.fn(),
  getStandings: jest.fn(),
};

const TOURNAMENT = {
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

describe('TournamentsController', () => {
  let controller: TournamentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsController],
      providers: [{ provide: TournamentsService, useValue: mockTournamentsService }],
    }).compile();

    controller = module.get<TournamentsController>(TournamentsController);
    jest.clearAllMocks();
  });

  it('createTournament() delegates to the service', async () => {
    mockTournamentsService.createTournament.mockResolvedValueOnce(TOURNAMENT);
    const dto = {
      seasonName: 'October Championship',
      slug: 'october-championship',
      startsAt: new Date(),
      endsAt: new Date(),
    };

    const result = await controller.createTournament(dto);

    expect(mockTournamentsService.createTournament).toHaveBeenCalledWith(dto);
    expect(result.data.slug).toBe('october-championship');
  });

  it('listTournaments() forwards the parsed query', async () => {
    mockTournamentsService.listTournaments.mockResolvedValueOnce({
      items: [TOURNAMENT],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listTournaments({ page: 1, limit: 20 });

    expect(mockTournamentsService.listTournaments).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.data.items).toHaveLength(1);
  });

  it('getStandings() forwards the slug and parsed query', async () => {
    mockTournamentsService.getStandings.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await controller.getStandings('october-championship', { page: 1, limit: 20 });

    expect(mockTournamentsService.getStandings).toHaveBeenCalledWith('october-championship', {
      page: 1,
      limit: 20,
    });
  });
});
