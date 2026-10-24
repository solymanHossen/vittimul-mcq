import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { PaginationDto } from './dto/pagination.dto';
import {
  PaginatedStandings,
  PaginatedTournaments,
  TournamentDetail,
} from './interfaces/tournament.interface';

const TOURNAMENT_SELECT = {
  id: true,
  seasonName: true,
  slug: true,
  description: true,
  bannerUrl: true,
  startsAt: true,
  endsAt: true,
  prizePoolMeta: true,
  rulesMeta: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TournamentSelect;

type TournamentRow = Prisma.TournamentGetPayload<{ select: typeof TOURNAMENT_SELECT }>;

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTournament(dto: CreateTournamentDto): Promise<TournamentDetail> {
    const row = await this.prisma.tournament.create({
      data: {
        seasonName: dto.seasonName,
        slug: dto.slug,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        prizePoolMeta: dto.prizePoolMeta as Prisma.InputJsonValue | undefined,
        rulesMeta: dto.rulesMeta as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
      select: TOURNAMENT_SELECT,
    });
    return this.toDetail(row);
  }

  async listTournaments(query: PaginationDto): Promise<PaginatedTournaments> {
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.prisma.tournament.findMany({
        select: TOURNAMENT_SELECT,
        orderBy: { startsAt: Prisma.SortOrder.desc },
        skip,
        take: query.limit,
      }),
      this.prisma.tournament.count(),
    ]);

    return {
      items: rows.map((row) => this.toDetail(row)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getStandings(slug: string, query: PaginationDto): Promise<PaginatedStandings> {
    const tournament = await this.prisma.tournament.findFirstOrThrow({
      where: { slug },
      select: { id: true },
    });

    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.prisma.tournamentRanking.findMany({
        where: { tournamentId: tournament.id },
        orderBy: [
          { cumulativeScore: Prisma.SortOrder.desc },
          { totalTimeSeconds: Prisma.SortOrder.asc },
        ],
        skip,
        take: query.limit,
        select: {
          userId: true,
          examsParticipated: true,
          cumulativeScore: true,
          totalTimeSeconds: true,
          finalRank: true,
          user: { select: { name: true, institutionName: true, avatarUrl: true } },
        },
      }),
      this.prisma.tournamentRanking.count({ where: { tournamentId: tournament.id } }),
    ]);

    return {
      items: rows.map((row, index) => ({
        rank: skip + index + 1,
        userId: row.userId,
        name: row.user.name,
        institutionName: row.user.institutionName,
        avatarUrl: row.user.avatarUrl,
        examsParticipated: row.examsParticipated,
        cumulativeScore: row.cumulativeScore.toNumber(),
        totalTimeSeconds: row.totalTimeSeconds,
        finalRank: row.finalRank,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private toDetail(row: TournamentRow): TournamentDetail {
    return {
      id: row.id,
      seasonName: row.seasonName,
      slug: row.slug,
      description: row.description,
      bannerUrl: row.bannerUrl,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      prizePoolMeta: row.prizePoolMeta,
      rulesMeta: row.rulesMeta,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
