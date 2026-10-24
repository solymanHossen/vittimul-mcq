import { ApiProperty } from '@nestjs/swagger';
import type { TournamentDetail } from '../interfaces/tournament.interface';

export class TournamentEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'October Championship' })
  seasonName: string;

  @ApiProperty({ example: 'october-championship' })
  slug: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  bannerUrl: string | null;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  prizePoolMeta: unknown;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  rulesMeta: unknown;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(tournament: TournamentDetail) {
    this.id = tournament.id;
    this.seasonName = tournament.seasonName;
    this.slug = tournament.slug;
    this.description = tournament.description;
    this.bannerUrl = tournament.bannerUrl;
    this.startsAt = tournament.startsAt;
    this.endsAt = tournament.endsAt;
    this.prizePoolMeta = tournament.prizePoolMeta;
    this.rulesMeta = tournament.rulesMeta;
    this.isActive = tournament.isActive;
    this.createdAt = tournament.createdAt;
    this.updatedAt = tournament.updatedAt;
  }
}
