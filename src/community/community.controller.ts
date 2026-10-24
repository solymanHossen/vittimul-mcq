import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CommunityService } from './community.service';
import { CreateCommentSchema, type CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportSchema, type CreateReportDto } from './dto/create-report.dto';
import { ResolveReportSchema, type ResolveReportDto } from './dto/resolve-report.dto';
import { CommentEntity } from './entities/comment.entity';
import { ReportEntity } from './entities/report.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

const MODERATOR_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.INSTRUCTOR, Role.MODERATOR] as const;
const REPORT_RESOLVER_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR] as const;

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('questions/:questionId/comments')
  @Public()
  @ApiOperation({ summary: "List a question's comments with nested replies" })
  @ApiResponse({ status: HttpStatus.OK, type: [CommentEntity] })
  async listComments(
    @Param('questionId', ParseBigIntPipe) questionId: bigint,
  ): Promise<{ message: string; data: CommentEntity[] }> {
    const comments = await this.communityService.listComments(questionId);
    return {
      message: 'Comments retrieved successfully',
      data: comments.map((comment) => new CommentEntity(comment)),
    };
  }

  @Post('questions/:questionId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a comment or reply on a question' })
  @ApiBody({ schema: z.toJSONSchema(CreateCommentSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: CommentEntity })
  async createComment(
    @Param('questionId', ParseBigIntPipe) questionId: bigint,
    @Body(new ZodValidationPipe(CreateCommentSchema)) dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: CommentEntity }> {
    const comment = await this.communityService.createComment(questionId, user.id, dto);
    return { message: 'Comment posted successfully', data: new CommentEntity(comment) };
  }

  @Post('comments/:commentId/upvote')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle an upvote on a comment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Upvote toggled' })
  async toggleUpvote(
    @Param('commentId', ParseBigIntPipe) commentId: bigint,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: { upvoted: boolean; upvotes: number } }> {
    const result = await this.communityService.toggleUpvote(commentId, user.id);
    return {
      message: result.upvoted ? 'Comment upvoted' : 'Upvote removed',
      data: result,
    };
  }

  @Patch('comments/:commentId/verify')
  @ApiBearerAuth()
  @Roles(...MODERATOR_ROLES)
  @ApiOperation({ summary: 'Mark a comment as verified by a teacher' })
  @ApiResponse({ status: HttpStatus.OK, type: CommentEntity })
  async verifyComment(
    @Param('commentId', ParseBigIntPipe) commentId: bigint,
  ): Promise<{ message: string; data: CommentEntity }> {
    const comment = await this.communityService.verifyComment(commentId);
    return { message: 'Comment verified successfully', data: new CommentEntity(comment) };
  }

  @Post('questions/:questionId/reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report an error on a question' })
  @ApiBody({ schema: z.toJSONSchema(CreateReportSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: ReportEntity })
  async createReport(
    @Param('questionId', ParseBigIntPipe) questionId: bigint,
    @Body(new ZodValidationPipe(CreateReportSchema)) dto: CreateReportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: ReportEntity }> {
    const report = await this.communityService.createReport(questionId, user.id, dto);
    return { message: 'Report submitted successfully', data: new ReportEntity(report) };
  }

  @Patch('reports/:reportId/resolve')
  @ApiBearerAuth()
  @Roles(...REPORT_RESOLVER_ROLES)
  @ApiOperation({ summary: 'Resolve or reject a question error report' })
  @ApiBody({ schema: z.toJSONSchema(ResolveReportSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: ReportEntity })
  async resolveReport(
    @Param('reportId', ParseBigIntPipe) reportId: bigint,
    @Body(new ZodValidationPipe(ResolveReportSchema)) dto: ResolveReportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: ReportEntity }> {
    const report = await this.communityService.resolveReport(reportId, user.id, dto);
    return { message: 'Report resolved successfully', data: new ReportEntity(report) };
  }
}
