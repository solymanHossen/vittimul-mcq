export interface TournamentDetail {
  id: number;
  seasonName: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  prizePoolMeta: unknown;
  rulesMeta: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTournaments {
  items: TournamentDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface StandingEntry {
  rank: number;
  userId: number;
  name: string | null;
  institutionName: string | null;
  avatarUrl: string | null;
  examsParticipated: number;
  cumulativeScore: number;
  totalTimeSeconds: number;
  finalRank: number | null;
}

export interface PaginatedStandings {
  items: StandingEntry[];
  total: number;
  page: number;
  limit: number;
}
