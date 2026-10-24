import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeaderboardService } from './leaderboard.service';
import { QueryLeaderboardSchema, type QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import {
  LeaderboardEntryEntity,
  CurrentUserStandingEntity,
} from './entities/leaderboard-entry.entity';

interface LeaderboardResponseData {
  items: LeaderboardEntryEntity[];
  total: number;
  page: number;
  limit: number;
  currentUser: CurrentUserStandingEntity | null;
}

@ApiTags('Leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('exams/:examId')
  @ApiOperation({ summary: "Paginated merit list for an exam, with the current user's rank" })
  @ApiResponse({ status: HttpStatus.OK, description: 'Leaderboard page' })
  async getLeaderboard(
    @Param('examId', ParseBigIntPipe) examId: bigint,
    @Query(new ZodValidationPipe(QueryLeaderboardSchema)) query: QueryLeaderboardDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: LeaderboardResponseData }> {
    const result = await this.leaderboardService.getLeaderboard(examId, query, user.id);
    return {
      message: 'Leaderboard retrieved successfully',
      data: {
        items: result.items.map((entry) => new LeaderboardEntryEntity(entry)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        currentUser: result.currentUser ? new CurrentUserStandingEntity(result.currentUser) : null,
      },
    };
  }

  @Post('exams/:examId/finalize')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Persist final merit positions and percentiles, and update tournament standings',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Attempts finalized' })
  async finalizeExam(
    @Param('examId', ParseBigIntPipe) examId: bigint,
  ): Promise<{ message: string; data: { updatedAttempts: number } }> {
    const result = await this.leaderboardService.finalizeExam(examId);
    return {
      message: `${result.updatedAttempts} attempts finalized`,
      data: result,
    };
  }
}
