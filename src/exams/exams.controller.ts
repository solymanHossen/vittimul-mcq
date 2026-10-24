import {
  Body,
  Controller,
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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExamsService } from './exams.service';
import { CreateExamSchema, type CreateExamDto } from './dto/create-exam.dto';
import { AssignQuestionsSchema, type AssignQuestionsDto } from './dto/assign-questions.dto';
import { QueryExamsSchema, type QueryExamsDto } from './dto/query-exams.dto';
import { ExamDetailEntity } from './entities/exam-detail.entity';
import { ExamSummaryEntity } from './entities/exam-summary.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

const SETTER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.INSTRUCTOR] as const;

interface PaginatedExamsResponseData {
  items: ExamSummaryEntity[];
  total: number;
  page: number;
  limit: number;
}

@ApiTags('Exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(...SETTER_ROLES)
  @ApiOperation({ summary: 'Create an exam, optionally with its sections' })
  @ApiBody({
    // `unrepresentable: 'any'` — CreateExamSchema's startTime/endTime/
    // resultPublishTime are `z.coerce.date()`, and JSON Schema has no Date
    // type; without this, toJSONSchema() throws at decorator-evaluation
    // time (i.e. at module load, crashing app startup, not just this route).
    schema: z.toJSONSchema(CreateExamSchema, {
      unrepresentable: 'any',
    }) as unknown as ApiBodySchema,
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: ExamDetailEntity })
  async createExam(
    @Body(new ZodValidationPipe(CreateExamSchema)) dto: CreateExamDto,
  ): Promise<{ message: string; data: ExamDetailEntity }> {
    const exam = await this.examsService.createExam(dto);
    return { message: 'Exam created successfully', data: new ExamDetailEntity(exam) };
  }

  @Post(':id/questions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(...SETTER_ROLES)
  @ApiOperation({ summary: 'Assign an ordered set of questions to the exam' })
  @ApiBody({ schema: z.toJSONSchema(AssignQuestionsSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: ExamDetailEntity })
  async assignQuestions(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body(new ZodValidationPipe(AssignQuestionsSchema)) dto: AssignQuestionsDto,
  ): Promise<{ message: string; data: ExamDetailEntity }> {
    const exam = await this.examsService.assignQuestions(id, dto);
    return { message: 'Questions assigned successfully', data: new ExamDetailEntity(exam) };
  }

  @Patch(':id/publish')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish the exam, pre-warming the runtime question-paper cache' })
  @ApiResponse({ status: HttpStatus.OK, type: ExamDetailEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No questions assigned, or totalMarks is zero',
  })
  async publishExam(
    @Param('id', ParseBigIntPipe) id: bigint,
  ): Promise<{ message: string; data: ExamDetailEntity }> {
    const exam = await this.examsService.publishExam(id);
    return { message: 'Exam published successfully', data: new ExamDetailEntity(exam) };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List published exams, filterable by category, type, and status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated exam list' })
  async listExams(
    @Query(new ZodValidationPipe(QueryExamsSchema)) query: QueryExamsDto,
  ): Promise<{ message: string; data: PaginatedExamsResponseData }> {
    const result = await this.examsService.listExams(query);
    return {
      message: 'Exams retrieved successfully',
      data: {
        items: result.items.map((item) => new ExamSummaryEntity(item)),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Exam metadata, syllabus, and section breakdown',
    description: 'Never returns questions — those are only revealed after starting an attempt.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: ExamDetailEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Exam not found or not published' })
  async getExamBySlug(
    @Param('slug') slug: string,
  ): Promise<{ message: string; data: ExamDetailEntity }> {
    const exam = await this.examsService.getExamBySlug(slug);
    return { message: 'Exam retrieved successfully', data: new ExamDetailEntity(exam) };
  }
}
