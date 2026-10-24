export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string | null;
  institutionName: string | null;
  avatarUrl: string | null;
  obtainedScore: number;
  timeTakenSeconds: number;
}

export interface CurrentUserStanding {
  rank: number;
  obtainedScore: number;
  timeTakenSeconds: number;
  percentile: number;
}

export interface LeaderboardResult {
  items: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  currentUser: CurrentUserStanding | null;
}
