import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { leaderboardKey } from './leaderboard.constants';
import { encodeCompositeScore, decodeCompositeScore } from './composite-score.util';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { LeaderboardEntry, LeaderboardResult } from './interfaces/leaderboard.interface';

interface UserSummary {
  name: string | null;
  institutionName: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Called by the exam-runtime submit flow for every officially-evaluated attempt. */
  async recordScore(
    examId: bigint,
    userId: number,
    obtainedScore: number,
    timeTakenSeconds: number,
  ): Promise<void> {
    const compositeScore = encodeCompositeScore(obtainedScore, timeTakenSeconds);
    await this.redis.client.zadd(leaderboardKey(examId), compositeScore, userId.toString());
  }

  async getLeaderboard(
    examId: bigint,
    query: QueryLeaderboardDto,
    currentUserId?: number,
  ): Promise<LeaderboardResult> {
    const key = leaderboardKey(examId);
    const start = (query.page - 1) * query.limit;
    const stop = start + query.limit - 1;

    const [raw, total] = await Promise.all([
      this.redis.client.zrevrange(key, start, stop, 'WITHSCORES'),
      this.redis.client.zcard(key),
    ]);

    const pageEntries: { userId: number; obtainedScore: number; timeTakenSeconds: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const scoreStr = raw[i + 1];
      if (member === undefined || scoreStr === undefined) continue;
      const { obtainedScore, timeTakenSeconds } = decodeCompositeScore(Number(scoreStr));
      pageEntries.push({ userId: Number(member), obtainedScore, timeTakenSeconds });
    }

    const userIds = pageEntries.map((entry) => entry.userId);
    const users =
      userIds.length > 0 ? await this.fetchUsers(userIds) : new Map<number, UserSummary>();

    const items: LeaderboardEntry[] = pageEntries.map((entry, index) => {
      const user = users.get(entry.userId);
      return {
        rank: start + index + 1,
        userId: entry.userId,
        name: user?.name ?? null,
        institutionName: user?.institutionName ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        obtainedScore: entry.obtainedScore,
        timeTakenSeconds: entry.timeTakenSeconds,
      };
    });

    const currentUser =
      currentUserId !== undefined
        ? await this.getCurrentUserStanding(key, currentUserId, total)
        : null;

    return { items, total, page: query.page, limit: query.limit, currentUser };
  }

  /**
   * Persists final `meritPosition`/`percentileScore` using a single
   * window-function UPDATE (DENSE_RANK over obtainedScore desc, time asc) —
   * one query regardless of participant count, not a per-attempt loop. Then,
   * if the exam belongs to a tournament, aggregates every official attempt
   * into TournamentRanking via one INSERT ... ON CONFLICT DO UPDATE.
   */
  async finalizeExam(examId: bigint): Promise<{ updatedAttempts: number }> {
    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { tournamentId: true },
    });

    const updatedAttempts = await this.prisma.$executeRaw`
      UPDATE exam_attempts AS ea
      SET
        merit_position = ranked.rank,
        percentile_score = ROUND(((ranked.total - ranked.rank)::numeric / ranked.total) * 100, 2)
      FROM (
        SELECT
          id,
          DENSE_RANK() OVER (ORDER BY obtained_score DESC, time_taken_seconds ASC) AS rank,
          COUNT(*) OVER () AS total
        FROM exam_attempts
        WHERE exam_id = ${examId} AND is_official = true AND status = 'EVALUATED'
      ) AS ranked
      WHERE ea.id = ranked.id
    `;

    if (exam.tournamentId !== null) {
      await this.upsertTournamentRankings(exam.tournamentId, examId);
    }

    return { updatedAttempts };
  }

  private async upsertTournamentRankings(tournamentId: number, examId: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO tournament_rankings (tournament_id, user_id, exams_participated, cumulative_score, total_time_seconds, updated_at)
      SELECT ${tournamentId}, user_id, 1, obtained_score, time_taken_seconds, NOW()
      FROM exam_attempts
      WHERE exam_id = ${examId} AND is_official = true AND status = 'EVALUATED'
      ON CONFLICT (tournament_id, user_id) DO UPDATE SET
        exams_participated = tournament_rankings.exams_participated + 1,
        cumulative_score = tournament_rankings.cumulative_score + EXCLUDED.cumulative_score,
        total_time_seconds = tournament_rankings.total_time_seconds + EXCLUDED.total_time_seconds,
        updated_at = NOW()
    `;
  }

  private async getCurrentUserStanding(
    key: string,
    userId: number,
    total: number,
  ): Promise<LeaderboardResult['currentUser']> {
    if (total === 0) return null;

    const [rank, scoreStr] = await Promise.all([
      this.redis.client.zrevrank(key, userId.toString()),
      this.redis.client.zscore(key, userId.toString()),
    ]);

    if (rank === null || scoreStr === null) return null;

    const { obtainedScore, timeTakenSeconds } = decodeCompositeScore(Number(scoreStr));
    const oneBasedRank = rank + 1;
    const percentile = Math.round(((total - oneBasedRank) / total) * 100 * 100) / 100;

    return { rank: oneBasedRank, obtainedScore, timeTakenSeconds, percentile };
  }

  private async fetchUsers(userIds: number[]): Promise<Map<number, UserSummary>> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, institutionName: true, avatarUrl: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }
}
