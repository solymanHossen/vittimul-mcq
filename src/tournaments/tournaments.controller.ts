import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentSchema, type CreateTournamentDto } from './dto/create-tournament.dto';
import { PaginationSchema, type PaginationDto } from './dto/pagination.dto';
import { TournamentEntity } from './entities/tournament.entity';
import { StandingEntity } from './entities/standing.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

interface PaginatedTournamentsResponseData {
  items: TournamentEntity[];
  total: number;
  page: number;
  limit: number;
}

interface PaginatedStandingsResponseData {
  items: StandingEntity[];
  total: number;
  page: number;
  limit: number;
}

@ApiTags('Tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a tournament season' })
  @ApiBody({
    // See exams.controller.ts for why `unrepresentable: 'any'` is required —
    // startsAt/endsAt are `z.coerce.date()`, which JSON Schema can't
    // represent; without this, toJSONSchema() throws at module-load time.
    schema: z.toJSONSchema(CreateTournamentSchema, {
      unrepresentable: 'any',
    }) as unknown as ApiBodySchema,
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: TournamentEntity })
  async createTournament(
    @Body(new ZodValidationPipe(CreateTournamentSchema)) dto: CreateTournamentDto,
  ): Promise<{ message: string; data: TournamentEntity }> {
    const tournament = await this.tournamentsService.createTournament(dto);
    return { message: 'Tournament created successfully', data: new TournamentEntity(tournament) };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List tournament seasons' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated tournament list' })
  async listTournaments(
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
  ): Promise<{ message: string; data: PaginatedTournamentsResponseData }> {
    const result = await this.tournamentsService.listTournaments(query);
    return {
      message: 'Tournaments retrieved successfully',
      data: {
        items: result.items.map((item) => new TournamentEntity(item)),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':slug/standings')
  @Public()
  @ApiOperation({ summary: 'Paginated tournament standings, ranked by cumulative score' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated standings' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tournament not found' })
  async getStandings(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
  ): Promise<{ message: string; data: PaginatedStandingsResponseData }> {
    const result = await this.tournamentsService.getStandings(slug, query);
    return {
      message: 'Standings retrieved successfully',
      data: {
        items: result.items.map((item) => new StandingEntity(item)),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }
}
