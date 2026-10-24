import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { VocabularyService } from './vocabulary.service';
import {
  CreateVocabularyCardSchema,
  type CreateVocabularyCardDto,
} from './dto/create-vocabulary-card.dto';
import {
  QueryVocabularyCardsSchema,
  type QueryVocabularyCardsDto,
} from './dto/query-vocabulary-cards.dto';
import { ReviewCardSchema, type ReviewCardDto } from './dto/review-card.dto';
import { VocabularyCardEntity } from './entities/vocabulary-card.entity';
import { DueVocabularyCardEntity } from './entities/due-vocabulary-card.entity';
import { VocabularyProgressEntity } from './entities/vocabulary-progress.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

interface PaginatedCardsResponseData {
  items: VocabularyCardEntity[];
  total: number;
  page: number;
  limit: number;
}

@ApiTags('Vocabulary')
@ApiBearerAuth()
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Post('cards')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.INSTRUCTOR)
  @ApiOperation({ summary: 'Create a vocabulary flashcard' })
  @ApiBody({ schema: z.toJSONSchema(CreateVocabularyCardSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: VocabularyCardEntity })
  async createCard(
    @Body(new ZodValidationPipe(CreateVocabularyCardSchema)) dto: CreateVocabularyCardDto,
  ): Promise<{ message: string; data: VocabularyCardEntity }> {
    const card = await this.vocabularyService.createCard(dto);
    return {
      message: 'Vocabulary card created successfully',
      data: new VocabularyCardEntity(card),
    };
  }

  @Get('cards')
  @ApiOperation({ summary: 'List vocabulary cards, optionally filtered by topic or difficulty' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated card list' })
  async listCards(
    @Query(new ZodValidationPipe(QueryVocabularyCardsSchema)) query: QueryVocabularyCardsDto,
  ): Promise<{ message: string; data: PaginatedCardsResponseData }> {
    const result = await this.vocabularyService.listCards(query);
    return {
      message: 'Vocabulary cards retrieved successfully',
      data: {
        items: result.items.map((item) => new VocabularyCardEntity(item)),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get('due')
  @ApiOperation({ summary: 'Flashcards due for review today (Leitner 5-box system)' })
  @ApiResponse({ status: HttpStatus.OK, type: [DueVocabularyCardEntity] })
  async getDueCards(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: DueVocabularyCardEntity[] }> {
    const cards = await this.vocabularyService.getDueCards(user.id);
    return {
      message: 'Due flashcards retrieved successfully',
      data: cards.map((card) => new DueVocabularyCardEntity(card)),
    };
  }

  @Post('review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a flashcard review and advance its Leitner box' })
  @ApiBody({ schema: z.toJSONSchema(ReviewCardSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: VocabularyProgressEntity })
  async reviewCard(
    @Body(new ZodValidationPipe(ReviewCardSchema)) dto: ReviewCardDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: VocabularyProgressEntity }> {
    const result = await this.vocabularyService.reviewCard(user.id, dto);
    return { message: 'Review recorded successfully', data: new VocabularyProgressEntity(result) };
  }
}
