import { ApiProperty } from '@nestjs/swagger';
import type { LeaderboardEntry, CurrentUserStanding } from '../interfaces/leaderboard.interface';

export class LeaderboardEntryEntity {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: 42 })
  userId: number;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  institutionName: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 85.5 })
  obtainedScore: number;

  @ApiProperty({ example: 1740 })
  timeTakenSeconds: number;

  constructor(entry: LeaderboardEntry) {
    this.rank = entry.rank;
    this.userId = entry.userId;
    this.name = entry.name;
    this.institutionName = entry.institutionName;
    this.avatarUrl = entry.avatarUrl;
    this.obtainedScore = entry.obtainedScore;
    this.timeTakenSeconds = entry.timeTakenSeconds;
  }
}

export class CurrentUserStandingEntity {
  @ApiProperty({ example: 57 })
  rank: number;

  @ApiProperty({ example: 72.5 })
  obtainedScore: number;

  @ApiProperty({ example: 2103 })
  timeTakenSeconds: number;

  @ApiProperty({ example: 88.21, description: 'Percentile — higher is better' })
  percentile: number;

  constructor(standing: CurrentUserStanding) {
    this.rank = standing.rank;
    this.obtainedScore = standing.obtainedScore;
    this.timeTakenSeconds = standing.timeTakenSeconds;
    this.percentile = standing.percentile;
  }
}
