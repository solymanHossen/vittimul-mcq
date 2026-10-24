import { ApiProperty } from '@nestjs/swagger';
import type { StandingEntry } from '../interfaces/tournament.interface';

export class StandingEntity {
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

  @ApiProperty({ example: 5 })
  examsParticipated: number;

  @ApiProperty({ example: 420.5 })
  cumulativeScore: number;

  @ApiProperty({ example: 10800 })
  totalTimeSeconds: number;

  @ApiProperty({ example: null, nullable: true })
  finalRank: number | null;

  constructor(entry: StandingEntry) {
    this.rank = entry.rank;
    this.userId = entry.userId;
    this.name = entry.name;
    this.institutionName = entry.institutionName;
    this.avatarUrl = entry.avatarUrl;
    this.examsParticipated = entry.examsParticipated;
    this.cumulativeScore = entry.cumulativeScore;
    this.totalTimeSeconds = entry.totalTimeSeconds;
    this.finalRank = entry.finalRank;
  }
}
