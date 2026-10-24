import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TaxonomyService } from './taxonomy.service';
import { CreateCategorySchema, type CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategorySchema, type UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubjectSchema, type CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectSchema, type UpdateSubjectDto } from './dto/update-subject.dto';
import { QuerySubjectsSchema, type QuerySubjectsDto } from './dto/query-subjects.dto';
import { CreateTopicSchema, type CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicSchema, type UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsSchema, type QueryTopicsDto } from './dto/query-topics.dto';
import { CategoryEntity } from './entities/category.entity';
import { SubjectEntity } from './entities/subject.entity';
import { TopicEntity } from './entities/topic.entity';
import { TaxonomyTreeCategory } from './interfaces/taxonomy-tree.interface';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

const STAFF_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.INSTRUCTOR] as const;

@ApiTags('Taxonomy')
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('tree')
  @Public()
  @ApiOperation({ summary: 'Active Category -> Subject -> Topic hierarchy (Redis-cached)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Taxonomy tree' })
  async getTree(): Promise<{ message: string; data: TaxonomyTreeCategory[] }> {
    const tree = await this.taxonomyService.getTree();
    return { message: 'Taxonomy tree retrieved successfully', data: tree };
  }

  // ── Categories ───────────────────────────────────────────────────────────

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: HttpStatus.OK, type: [CategoryEntity] })
  async listCategories(): Promise<{ message: string; data: CategoryEntity[] }> {
    const categories = await this.taxonomyService.listCategories();
    return {
      message: 'Categories retrieved successfully',
      data: categories.map((category) => new CategoryEntity(category)),
    };
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a category' })
  @ApiBody({ schema: z.toJSONSchema(CreateCategorySchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: CategoryEntity })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug already exists' })
  async createCategory(
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
  ): Promise<{ message: string; data: CategoryEntity }> {
    const category = await this.taxonomyService.createCategory(dto);
    return { message: 'Category created successfully', data: new CategoryEntity(category) };
  }

  @Patch('categories/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a category' })
  @ApiBody({ schema: z.toJSONSchema(UpdateCategorySchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: CategoryEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found' })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
  ): Promise<{ message: string; data: CategoryEntity }> {
    const category = await this.taxonomyService.updateCategory(id, dto);
    return { message: 'Category updated successfully', data: new CategoryEntity(category) };
  }

  @Delete('categories/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a category (cascades to its subjects and topics)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found' })
  async deleteCategory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.taxonomyService.deleteCategory(id);
    return { message: 'Category deleted successfully', data: null };
  }

  // ── Subjects ─────────────────────────────────────────────────────────────

  @Get('subjects')
  @Public()
  @ApiOperation({ summary: 'List subjects, optionally filtered by category' })
  @ApiResponse({ status: HttpStatus.OK, type: [SubjectEntity] })
  async listSubjects(
    @Query(new ZodValidationPipe(QuerySubjectsSchema)) query: QuerySubjectsDto,
  ): Promise<{ message: string; data: SubjectEntity[] }> {
    const subjects = await this.taxonomyService.listSubjects(query);
    return {
      message: 'Subjects retrieved successfully',
      data: subjects.map((subject) => new SubjectEntity(subject)),
    };
  }

  @Post('subjects')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a subject under a category' })
  @ApiBody({ schema: z.toJSONSchema(CreateSubjectSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: SubjectEntity })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug already exists in this category' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'categoryId does not exist',
  })
  async createSubject(
    @Body(new ZodValidationPipe(CreateSubjectSchema)) dto: CreateSubjectDto,
  ): Promise<{ message: string; data: SubjectEntity }> {
    const subject = await this.taxonomyService.createSubject(dto);
    return { message: 'Subject created successfully', data: new SubjectEntity(subject) };
  }

  @Patch('subjects/:id')
  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update a subject' })
  @ApiBody({ schema: z.toJSONSchema(UpdateSubjectSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: SubjectEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Subject not found' })
  async updateSubject(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateSubjectSchema)) dto: UpdateSubjectDto,
  ): Promise<{ message: string; data: SubjectEntity }> {
    const subject = await this.taxonomyService.updateSubject(id, dto);
    return { message: 'Subject updated successfully', data: new SubjectEntity(subject) };
  }

  @Delete('subjects/:id')
  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Delete a subject (cascades to its topics)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Subject deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Subject not found' })
  async deleteSubject(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.taxonomyService.deleteSubject(id);
    return { message: 'Subject deleted successfully', data: null };
  }

  // ── Topics ───────────────────────────────────────────────────────────────

  @Get('topics')
  @Public()
  @ApiOperation({ summary: 'List topics, optionally filtered by subject or parent topic' })
  @ApiResponse({ status: HttpStatus.OK, type: [TopicEntity] })
  async listTopics(
    @Query(new ZodValidationPipe(QueryTopicsSchema)) query: QueryTopicsDto,
  ): Promise<{ message: string; data: TopicEntity[] }> {
    const topics = await this.taxonomyService.listTopics(query);
    return {
      message: 'Topics retrieved successfully',
      data: topics.map((topic) => new TopicEntity(topic)),
    };
  }

  @Post('topics')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a topic (or sub-topic) under a subject' })
  @ApiBody({ schema: z.toJSONSchema(CreateTopicSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: TopicEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid parentId' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug already exists in this subject' })
  async createTopic(
    @Body(new ZodValidationPipe(CreateTopicSchema)) dto: CreateTopicDto,
  ): Promise<{ message: string; data: TopicEntity }> {
    const topic = await this.taxonomyService.createTopic(dto);
    return { message: 'Topic created successfully', data: new TopicEntity(topic) };
  }

  @Patch('topics/:id')
  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update a topic' })
  @ApiBody({ schema: z.toJSONSchema(UpdateTopicSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: TopicEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Topic not found' })
  async updateTopic(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateTopicSchema)) dto: UpdateTopicDto,
  ): Promise<{ message: string; data: TopicEntity }> {
    const topic = await this.taxonomyService.updateTopic(id, dto);
    return { message: 'Topic updated successfully', data: new TopicEntity(topic) };
  }

  @Delete('topics/:id')
  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Delete a topic (cascades to its sub-topics)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Topic deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Topic not found' })
  async deleteTopic(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.taxonomyService.deleteTopic(id);
    return { message: 'Topic deleted successfully', data: null };
  }
}
