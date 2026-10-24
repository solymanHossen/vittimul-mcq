import { PrismaClient, Prisma } from '@prisma/client';
import type { Seeder } from './seeder.interface';

export class TournamentSeeder implements Seeder {
  readonly name = 'TournamentSeeder';
  readonly description =
    'Seeds competitive tournaments, prize pool configurations, and user rankings';
  readonly order = 4;

  private static readonly TOURNAMENT_SLUG = 'bcs-champions-league-2026-s1';

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🏆 Seeding Tournaments and Rankings...');

    const now = new Date();
    const startsAt = new Date(now.getTime() - 7 * 86_400_000); // Started 7 days ago
    const endsAt = new Date(now.getTime() + 14 * 86_400_000); // Ends in 14 days

    const prizePoolMeta: Prisma.InputJsonValue = {
      totalPrizeBDT: 50000,
      rewards: [
        { rank: 1, prizeBDT: 20000, badge: 'Grand Champion', perk: 'Lifetime Premium' },
        { rank: 2, prizeBDT: 10000, badge: 'First Runner Up', perk: '1-Year Premium' },
        { rank: 3, prizeBDT: 5000, badge: 'Second Runner Up', perk: '6-Month Premium' },
        { rank: '4-10', prizeBDT: 2000, badge: 'Top 10 Finalist', perk: '3-Month Premium' },
      ],
    };

    const rulesMeta: Prisma.InputJsonValue = {
      markingSystem: {
        correctMarks: 1.0,
        negativeMarks: 0.25,
      },
      eligibility: {
        minimumExamsToQualify: 3,
        antiCheatStrictness: 'CRITICAL',
      },
      tieBreaker: 'Fastest total cumulative submission time',
    };

    const tournament = await prisma.tournament.upsert({
      where: { slug: TournamentSeeder.TOURNAMENT_SLUG },
      create: {
        seasonName: 'BCS Champions League 2026 (Season 1)',
        slug: TournamentSeeder.TOURNAMENT_SLUG,
        description:
          'Nationwide competitive MCQ tournament designed to test aspirants under real examination pressure with cash prizes and institutional accolades.',
        bannerUrl:
          'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=1200&q=80',
        startsAt,
        endsAt,
        prizePoolMeta,
        rulesMeta,
        isActive: true,
      },
      update: {
        startsAt,
        endsAt,
        prizePoolMeta,
        rulesMeta,
      },
      select: { id: true },
    });

    // Connect the live exam from EdTechSeeder to this tournament if present
    await prisma.exam.updateMany({
      where: { slug: 'weekly-mock-test-1' },
      data: { tournamentId: tournament.id },
    });

    // Seed mock rankings for regular users
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      take: 8,
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (users.length > 0) {
      const mockScores: Array<{ exams: number; score: string; timeSeconds: number }> = [
        { exams: 5, score: '48.50', timeSeconds: 3200 },
        { exams: 5, score: '46.25', timeSeconds: 3450 },
        { exams: 4, score: '38.00', timeSeconds: 2900 },
        { exams: 4, score: '35.75', timeSeconds: 3100 },
        { exams: 3, score: '28.50', timeSeconds: 2400 },
        { exams: 3, score: '27.00', timeSeconds: 2550 },
        { exams: 2, score: '18.25', timeSeconds: 1800 },
        { exams: 1, score: '9.00', timeSeconds: 950 },
      ];

      for (const [index, user] of users.entries()) {
        const perf = mockScores[index] ?? { exams: 1, score: '5.00', timeSeconds: 1200 };
        const rank = index + 1;

        await prisma.tournamentRanking.upsert({
          where: {
            tournamentId_userId: {
              tournamentId: tournament.id,
              userId: user.id,
            },
          },
          create: {
            tournamentId: tournament.id,
            userId: user.id,
            examsParticipated: perf.exams,
            cumulativeScore: new Prisma.Decimal(perf.score),
            totalTimeSeconds: perf.timeSeconds,
            currentRank: rank,
            finalRank: null,
            rewardClaimed: false,
          },
          update: {
            examsParticipated: perf.exams,
            cumulativeScore: new Prisma.Decimal(perf.score),
            totalTimeSeconds: perf.timeSeconds,
            currentRank: rank,
          },
        });
      }

      console.info(`🏅 Seeded ${users.length} tournament leaderboard positions.`);
    }
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await prisma.tournament.deleteMany({
      where: { slug: TournamentSeeder.TOURNAMENT_SLUG },
    });
    console.info('↩️ TournamentSeeder rolled back.');
  }
}
