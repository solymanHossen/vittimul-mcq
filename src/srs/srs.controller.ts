import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SrsService } from './srs.service';
import { ReviewQuestionSchema, type ReviewQuestionDto } from './dto/review-question.dto';
import { UpsertFavoriteSchema, type UpsertFavoriteDto } from './dto/upsert-favorite.dto';
import { DueQuestionEntity } from './entities/due-question.entity';
import { SrsReviewResultEntity } from './entities/srs-review-result.entity';
import { FavoriteEntity } from './entities/favorite.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Spaced Repetition')
@ApiBearerAuth()
@Controller('srs')
export class SrsController {
  constructor(private readonly srsService: SrsService) {}

  @Get('due')
  @ApiOperation({ summary: 'Questions due for spaced-repetition review today' })
  @ApiResponse({ status: HttpStatus.OK, type: [DueQuestionEntity] })
  async getDueQuestions(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: DueQuestionEntity[] }> {
    const questions = await this.srsService.getDueQuestions(user.id);
    return {
      message: 'Due questions retrieved successfully',
      data: questions.map((question) => new DueQuestionEntity(question)),
    };
  }

  @Post('review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a self-assessed review and advance the SM-2 schedule' })
  @ApiBody({ schema: z.toJSONSchema(ReviewQuestionSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: SrsReviewResultEntity })
  async reviewQuestion(
    @Body(new ZodValidationPipe(ReviewQuestionSchema)) dto: ReviewQuestionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: SrsReviewResultEntity }> {
    const result = await this.srsService.reviewQuestion(user.id, dto);
    return { message: 'Review recorded successfully', data: new SrsReviewResultEntity(result) };
  }

  @Post('favorites')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bookmark a question into a folder, with an optional personal note' })
  @ApiBody({ schema: z.toJSONSchema(UpsertFavoriteSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteEntity })
  async upsertFavorite(
    @Body(new ZodValidationPipe(UpsertFavoriteSchema)) dto: UpsertFavoriteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: FavoriteEntity }> {
    const favorite = await this.srsService.upsertFavorite(user.id, dto);
    return { message: 'Favorite saved successfully', data: new FavoriteEntity(favorite) };
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List bookmarked questions' })
  @ApiResponse({ status: HttpStatus.OK, type: [FavoriteEntity] })
  async listFavorites(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: FavoriteEntity[] }> {
    const favorites = await this.srsService.listFavorites(user.id);
    return {
      message: 'Favorites retrieved successfully',
      data: favorites.map((favorite) => new FavoriteEntity(favorite)),
    };
  }

  @Delete('favorites/:questionId')
  @ApiOperation({ summary: 'Remove a bookmark' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Favorite removed' })
  async deleteFavorite(
    @Param('questionId', ParseBigIntPipe) questionId: bigint,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: null }> {
    await this.srsService.deleteFavorite(user.id, questionId);
    return { message: 'Favorite removed successfully', data: null };
  }
}
