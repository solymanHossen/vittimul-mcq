import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { QuestionsService, QuestionListResult } from './questions.service';
import { CreateQuestionSchema, type CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionSchema, type UpdateQuestionDto } from './dto/update-question.dto';
import {
  BulkCreateQuestionsSchema,
  type BulkCreateQuestionsDto,
} from './dto/bulk-create-questions.dto';
import { QueryQuestionsSchema, type QueryQuestionsDto } from './dto/query-questions.dto';
import { CreatePassageSchema, type CreatePassageDto } from './dto/create-passage.dto';
import { QuestionEntity } from './entities/question.entity';
import { PassageEntity } from './entities/passage.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

const SETTER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.INSTRUCTOR] as const;
const STAFF_VIEW_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.INSTRUCTOR, Role.MODERATOR] as const;

interface QuestionListResponseData {
  items: QuestionEntity[];
  total: number;
  page: number;
  limit: number;
}

@ApiTags('Questions')
@ApiBearerAuth()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(...SETTER_ROLES)
  @ApiOperation({ summary: 'Create a question with its options' })
  @ApiBody({ schema: z.toJSONSchema(CreateQuestionSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: QuestionEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'topicId/passageId does not exist',
  })
  async createQuestion(
    @Body(new ZodValidationPipe(CreateQuestionSchema)) dto: CreateQuestionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: QuestionEntity }> {
    const question = await this.questionsService.createQuestion(dto, user.id);
    return { message: 'Question created successfully', data: new QuestionEntity(question) };
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...SETTER_ROLES)
  @ApiOperation({ summary: 'Transactionally create up to 100 questions at once' })
  @ApiBody({ schema: z.toJSONSchema(BulkCreateQuestionsSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'All questions created' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async bulkCreateQuestions(
    @Body(new ZodValidationPipe(BulkCreateQuestionsSchema)) dto: BulkCreateQuestionsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: { count: number; questions: QuestionEntity[] } }> {
    const result = await this.questionsService.bulkCreateQuestions(dto, user.id);
    return {
      message: `${result.count} questions created successfully`,
      data: {
        count: result.count,
        questions: result.questions.map((question) => new QuestionEntity(question)),
      },
    };
  }

  @Post('passages')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...SETTER_ROLES)
  @ApiOperation({ summary: 'Create a reading passage shared by one or more questions' })
  @ApiBody({ schema: z.toJSONSchema(CreatePassageSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: PassageEntity })
  async createPassage(
    @Body(new ZodValidationPipe(CreatePassageSchema)) dto: CreatePassageDto,
  ): Promise<{ message: string; data: PassageEntity }> {
    const passage = await this.questionsService.createPassage(dto);
    return { message: 'Passage created successfully', data: new PassageEntity(passage) };
  }

  @Get('passages/:id')
  @Roles(...STAFF_VIEW_ROLES)
  @ApiOperation({ summary: 'Get a passage by id' })
  @ApiResponse({ status: HttpStatus.OK, type: PassageEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Passage not found' })
  async getPassage(
    @Param('id', ParseBigIntPipe) id: bigint,
  ): Promise<{ message: string; data: PassageEntity }> {
    const passage = await this.questionsService.getPassageById(id);
    return { message: 'Passage retrieved successfully', data: new PassageEntity(passage) };
  }

  @Get()
  @Roles(...STAFF_VIEW_ROLES)
  @ApiOperation({ summary: 'Paginated question bank view (correct answers visible to staff)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated question list' })
  async listQuestions(
    @Query(new ZodValidationPipe(QueryQuestionsSchema)) query: QueryQuestionsDto,
  ): Promise<{ message: string; data: QuestionListResponseData }> {
    const result: QuestionListResult = await this.questionsService.listQuestions(query);
    return {
      message: 'Questions retrieved successfully',
      data: {
        items: result.items.map((item) => new QuestionEntity(item)),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':id')
  @Roles(...STAFF_VIEW_ROLES)
  @ApiOperation({ summary: 'Get a question by id (correct answers visible to staff)' })
  @ApiResponse({ status: HttpStatus.OK, type: QuestionEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Question not found' })
  async getQuestion(
    @Param('id', ParseBigIntPipe) id: bigint,
  ): Promise<{ message: string; data: QuestionEntity }> {
    const question = await this.questionsService.getQuestionById(id);
    return { message: 'Question retrieved successfully', data: new QuestionEntity(question) };
  }

  @Patch(':id')
  @Roles(...STAFF_VIEW_ROLES)
  @ApiOperation({
    summary: 'Update a question',
    description:
      'If the question is frozen (already used in a published exam or answered), updating ' +
      'questionText or options bumps `version` and records an AuditLog entry instead of ' +
      'silently overwriting history.',
  })
  @ApiBody({ schema: z.toJSONSchema(UpdateQuestionSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: QuestionEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Question not found' })
  async updateQuestion(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body(new ZodValidationPipe(UpdateQuestionSchema)) dto: UpdateQuestionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: QuestionEntity }> {
    const question = await this.questionsService.updateQuestion(id, dto, user.id);
    return { message: 'Question updated successfully', data: new QuestionEntity(question) };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a question' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Question deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Question not found' })
  async deleteQuestion(
    @Param('id', ParseBigIntPipe) id: bigint,
  ): Promise<{ message: string; data: null }> {
    await this.questionsService.deleteQuestion(id);
    return { message: 'Question deleted successfully', data: null };
  }
}
