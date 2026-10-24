import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { TAXONOMY_TREE_CACHE_KEY, TAXONOMY_TREE_CACHE_TTL_SECONDS } from './taxonomy.constants';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { TaxonomyTreeCategory } from './interfaces/taxonomy-tree.interface';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  iconUrl: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SUBJECT_SELECT = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  code: true,
  iconUrl: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const TOPIC_SELECT = {
  id: true,
  subjectId: true,
  parentId: true,
  name: true,
  slug: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class TaxonomyService {
  private readonly logger = new Logger(TaxonomyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Tree (public, cached) ───────────────────────────────────────────────

  async getTree(): Promise<TaxonomyTreeCategory[]> {
    const cached = await this.readTreeCache();
    if (cached) return cached;

    const tree = await this.buildTreeFromDatabase();
    await this.writeTreeCache(tree);

    return tree;
  }

  private async buildTreeFromDatabase(): Promise<TaxonomyTreeCategory[]> {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        displayOrder: true,
        subjects: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            iconUrl: true,
            displayOrder: true,
            topics: {
              // Top-level topics only — their subTopics are nested one level
              // below. Deeper nesting is rejected by createTopic/updateTopic,
              // so this always represents the full hierarchy.
              where: { isActive: true, parentId: null },
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true,
                name: true,
                slug: true,
                displayOrder: true,
                subTopics: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                  select: { id: true, name: true, slug: true, displayOrder: true },
                },
              },
            },
          },
        },
      },
    });
  }

  private async readTreeCache(): Promise<TaxonomyTreeCategory[] | null> {
    try {
      const cached = await this.redis.client.get(TAXONOMY_TREE_CACHE_KEY);
      return cached ? (JSON.parse(cached) as TaxonomyTreeCategory[]) : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Taxonomy tree cache read failed, falling back to database: ${message}`);
      return null;
    }
  }

  private async writeTreeCache(tree: TaxonomyTreeCategory[]): Promise<void> {
    try {
      await this.redis.client.set(
        TAXONOMY_TREE_CACHE_KEY,
        JSON.stringify(tree),
        'EX',
        TAXONOMY_TREE_CACHE_TTL_SECONDS,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Taxonomy tree cache write failed: ${message}`);
    }
  }

  private async invalidateTreeCache(): Promise<void> {
    try {
      await this.redis.client.del(TAXONOMY_TREE_CACHE_KEY);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Taxonomy tree cache invalidation failed: ${message}`);
    }
  }

  // ── Categories ───────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      select: CATEGORY_SELECT,
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({ data: dto, select: CATEGORY_SELECT });
    await this.invalidateTreeCache();
    return category;
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.update({
      where: { id },
      data: dto,
      select: CATEGORY_SELECT,
    });
    await this.invalidateTreeCache();
    return category;
  }

  async deleteCategory(id: number): Promise<void> {
    // Cascades to its Subjects and their Topics (onDelete: Cascade in the
    // schema); Questions under those topics are preserved with topicId set
    // to null (Question.topic is onDelete: SetNull).
    await this.prisma.category.delete({ where: { id } });
    await this.invalidateTreeCache();
  }

  // ── Subjects ─────────────────────────────────────────────────────────────

  async listSubjects(query: QuerySubjectsDto) {
    return this.prisma.subject.findMany({
      where: query.categoryId !== undefined ? { categoryId: query.categoryId } : undefined,
      orderBy: { displayOrder: 'asc' },
      select: SUBJECT_SELECT,
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({ data: dto, select: SUBJECT_SELECT });
    await this.invalidateTreeCache();
    return subject;
  }

  async updateSubject(id: number, dto: UpdateSubjectDto) {
    const subject = await this.prisma.subject.update({
      where: { id },
      data: dto,
      select: SUBJECT_SELECT,
    });
    await this.invalidateTreeCache();
    return subject;
  }

  async deleteSubject(id: number): Promise<void> {
    await this.prisma.subject.delete({ where: { id } });
    await this.invalidateTreeCache();
  }

  // ── Topics ───────────────────────────────────────────────────────────────

  async listTopics(query: QueryTopicsDto) {
    return this.prisma.topic.findMany({
      where: {
        ...(query.subjectId !== undefined ? { subjectId: query.subjectId } : {}),
        ...(query.parentId === 'root'
          ? { parentId: null }
          : query.parentId !== undefined
            ? { parentId: query.parentId }
            : {}),
      },
      orderBy: { displayOrder: 'asc' },
      select: TOPIC_SELECT,
    });
  }

  async createTopic(dto: CreateTopicDto) {
    if (dto.parentId !== undefined) {
      await this.assertValidParentTopic(dto.parentId, dto.subjectId);
    }

    const topic = await this.prisma.topic.create({ data: dto, select: TOPIC_SELECT });
    await this.invalidateTreeCache();
    return topic;
  }

  async updateTopic(id: number, dto: UpdateTopicDto) {
    if (dto.parentId) {
      // Checked before the subjectId lookup below so a self-reference fails
      // fast without a wasted query.
      if (dto.parentId === id) {
        throw new BadRequestException('A topic cannot be its own parent');
      }
      const subjectId = dto.subjectId ?? (await this.getTopicSubjectId(id));
      await this.assertValidParentTopic(dto.parentId, subjectId, id);
    }

    const topic = await this.prisma.topic.update({
      where: { id },
      data: dto,
      select: TOPIC_SELECT,
    });
    await this.invalidateTreeCache();
    return topic;
  }

  async deleteTopic(id: number): Promise<void> {
    // Cascades to its subTopics (onDelete: Cascade via the self-relation);
    // Questions under this topic are preserved with topicId set to null.
    await this.prisma.topic.delete({ where: { id } });
    await this.invalidateTreeCache();
  }

  private async getTopicSubjectId(id: number): Promise<number> {
    const topic = await this.prisma.topic.findUniqueOrThrow({
      where: { id },
      select: { subjectId: true },
    });
    return topic.subjectId;
  }

  /**
   * Enforces the two invariants Postgres can't express declaratively:
   * a sub-topic's parent must belong to the same subject, and must itself be
   * a top-level topic — capping the hierarchy at exactly two levels, which is
   * what `GET /taxonomy/tree` renders.
   */
  private async assertValidParentTopic(
    parentId: number,
    subjectId: number,
    selfId?: number,
  ): Promise<void> {
    if (parentId === selfId) {
      throw new BadRequestException('A topic cannot be its own parent');
    }

    const parent = await this.prisma.topic.findUnique({
      where: { id: parentId },
      select: { subjectId: true, parentId: true },
    });

    if (!parent) {
      throw new BadRequestException('Parent topic does not exist');
    }

    if (parent.subjectId !== subjectId) {
      throw new BadRequestException('Parent topic must belong to the same subject');
    }

    if (parent.parentId !== null) {
      throw new BadRequestException(
        'Parent topic must be a top-level topic (max two levels of nesting)',
      );
    }
  }
}
