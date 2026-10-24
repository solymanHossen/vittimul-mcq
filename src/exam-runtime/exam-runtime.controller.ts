import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExamRuntimeService } from './exam-runtime.service';
import { SyncAnswersSchema, type SyncAnswersDto } from './dto/sync-answers.dto';
import { AntiCheatEventSchema, type AntiCheatEventDto } from './dto/anti-cheat-event.dto';
import { AttemptStartEntity, AttemptResultEntity } from './entities/attempt.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Exam Runtime')
@ApiBearerAuth()
@Controller('exam-runtime')
export class ExamRuntimeController {
  constructor(private readonly examRuntimeService: ExamRuntimeService) {}

  @Post('exams/:examId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a new attempt, or resume an in-progress one' })
  @ApiResponse({ status: HttpStatus.OK, type: AttemptStartEntity })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Retakes not allowed, or premium required',
  })
  async startAttempt(
    @Param('examId', ParseBigIntPipe) examId: bigint,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: AttemptStartEntity }> {
    const result = await this.examRuntimeService.startAttempt(examId, user.id);
    return { message: 'Attempt started successfully', data: new AttemptStartEntity(result) };
  }

  @Patch('attempts/:attemptId/sync')
  @ApiOperation({ summary: 'Batch-autosave in-progress answers to Redis' })
  @ApiBody({ schema: z.toJSONSchema(SyncAnswersSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, description: 'Answers synced' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Attempt not in progress or expired',
  })
  async syncAnswers(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body(new ZodValidationPipe(SyncAnswersSchema)) dto: SyncAnswersDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: { synced: number } }> {
    const result = await this.examRuntimeService.syncAnswers(attemptId, user.id, dto);
    return { message: 'Answers synced successfully', data: result };
  }

  @Post('attempts/:attemptId/anti-cheat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report an anti-cheat telemetry event' })
  @ApiBody({ schema: z.toJSONSchema(AntiCheatEventSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, description: 'Event logged' })
  async recordAntiCheatEvent(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body(new ZodValidationPipe(AntiCheatEventSchema)) dto: AntiCheatEventDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: { disqualified: boolean } }> {
    const result = await this.examRuntimeService.recordAntiCheatEvent(attemptId, user.id, dto);
    return {
      message: result.disqualified
        ? 'Event logged — attempt disqualified for excessive tab switching'
        : 'Event logged successfully',
      data: result,
    };
  }

  @Post('attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit and deterministically evaluate an attempt' })
  @ApiResponse({ status: HttpStatus.OK, type: AttemptResultEntity })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Already being submitted' })
  async submitAttempt(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: AttemptResultEntity }> {
    const result = await this.examRuntimeService.submitAttempt(attemptId, user.id);
    return {
      message: 'Attempt submitted and evaluated successfully',
      data: new AttemptResultEntity(result),
    };
  }
}
