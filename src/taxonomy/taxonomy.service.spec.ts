import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { TaxonomyService } from './taxonomy.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { TAXONOMY_TREE_CACHE_KEY, TAXONOMY_TREE_CACHE_TTL_SECONDS } from './taxonomy.constants';

const mockPrisma = {
  category: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  subject: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  topic: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockRedisService = { client: mockRedisClient };

describe('TaxonomyService', () => {
  let service: TaxonomyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxonomyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<TaxonomyService>(TaxonomyService);
    jest.clearAllMocks();
  });

  describe('getTree()', () => {
    const sampleTree = [
      {
        id: 1,
        name: 'Bank Job',
        slug: 'bank-job',
        description: null,
        iconUrl: null,
        displayOrder: 0,
        subjects: [],
      },
    ];

    it('returns the cached tree without querying the database on a cache hit', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sampleTree));

      const result = await service.getTree();

      expect(result).toEqual(sampleTree);
      expect(mockRedisClient.get).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
      expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    });

    it('falls back to the database and populates the cache on a cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.category.findMany.mockResolvedValueOnce(sampleTree);

      const result = await service.getTree();

      expect(result).toEqual(sampleTree);
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        TAXONOMY_TREE_CACHE_KEY,
        JSON.stringify(sampleTree),
        'EX',
        TAXONOMY_TREE_CACHE_TTL_SECONDS,
      );
    });

    it('falls back to the database when the cache read throws', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      mockPrisma.category.findMany.mockResolvedValueOnce(sampleTree);

      const result = await service.getTree();

      expect(result).toEqual(sampleTree);
      expect(mockPrisma.category.findMany).toHaveBeenCalledTimes(1);
    });

    it('still returns the tree when the cache write fails', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.category.findMany.mockResolvedValueOnce(sampleTree);
      mockRedisClient.set.mockRejectedValueOnce(new Error('connection reset'));

      await expect(service.getTree()).resolves.toEqual(sampleTree);
    });
  });

  describe('categories', () => {
    it('lists categories ordered by displayOrder', async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([]);

      await service.listCategories();

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { displayOrder: 'asc' } }),
      );
    });

    it('creates a category and invalidates the tree cache', async () => {
      const dto = { name: 'Bank Job', slug: 'bank-job' };
      mockPrisma.category.create.mockResolvedValueOnce({ id: 1, ...dto });

      const result = await service.createCategory(dto);

      expect(result).toEqual({ id: 1, ...dto });
      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });

    it('updates a category and invalidates the tree cache', async () => {
      mockPrisma.category.update.mockResolvedValueOnce({ id: 1, name: 'Renamed' });

      await service.updateCategory(1, { name: 'Renamed' });

      expect(mockPrisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { name: 'Renamed' } }),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });

    it('deletes a category and invalidates the tree cache', async () => {
      mockPrisma.category.delete.mockResolvedValueOnce({ id: 1 });

      await service.deleteCategory(1);

      expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });
  });

  describe('subjects', () => {
    it('lists all subjects when no categoryId filter is given', async () => {
      mockPrisma.subject.findMany.mockResolvedValueOnce([]);

      await service.listSubjects({});

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('filters subjects by categoryId when given', async () => {
      mockPrisma.subject.findMany.mockResolvedValueOnce([]);

      await service.listSubjects({ categoryId: 3 });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { categoryId: 3 } }),
      );
    });

    it('creates a subject and invalidates the tree cache', async () => {
      const dto = { categoryId: 1, name: 'English', slug: 'english' };
      mockPrisma.subject.create.mockResolvedValueOnce({ id: 1, ...dto });

      await service.createSubject(dto);

      expect(mockPrisma.subject.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });

    it('deletes a subject and invalidates the tree cache', async () => {
      mockPrisma.subject.delete.mockResolvedValueOnce({ id: 1 });

      await service.deleteSubject(1);

      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });
  });

  describe('topics', () => {
    it('lists all topics when no filters are given', async () => {
      mockPrisma.topic.findMany.mockResolvedValueOnce([]);

      await service.listTopics({});

      expect(mockPrisma.topic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it("filters top-level topics when parentId is 'root'", async () => {
      mockPrisma.topic.findMany.mockResolvedValueOnce([]);

      await service.listTopics({ parentId: 'root' });

      expect(mockPrisma.topic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentId: null } }),
      );
    });

    it('filters sub-topics by a specific numeric parentId', async () => {
      mockPrisma.topic.findMany.mockResolvedValueOnce([]);

      await service.listTopics({ parentId: 5 });

      expect(mockPrisma.topic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentId: 5 } }),
      );
    });

    it('creates a top-level topic (no parentId) without a parent lookup', async () => {
      const dto = { subjectId: 1, name: 'Grammar', slug: 'grammar' };
      mockPrisma.topic.create.mockResolvedValueOnce({ id: 1, ...dto, parentId: null });

      await service.createTopic(dto);

      expect(mockPrisma.topic.findUnique).not.toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });

    it('creates a valid sub-topic whose parent is a top-level topic in the same subject', async () => {
      const dto = { subjectId: 1, parentId: 10, name: 'Tense', slug: 'tense' };
      mockPrisma.topic.findUnique.mockResolvedValueOnce({ subjectId: 1, parentId: null });
      mockPrisma.topic.create.mockResolvedValueOnce({ id: 2, ...dto });

      await service.createTopic(dto);

      expect(mockPrisma.topic.create).toHaveBeenCalledWith(expect.objectContaining({ data: dto }));
    });

    it('rejects a sub-topic whose parent does not exist', async () => {
      mockPrisma.topic.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createTopic({ subjectId: 1, parentId: 999, name: 'Tense', slug: 'tense' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.topic.create).not.toHaveBeenCalled();
    });

    it('rejects a sub-topic whose parent belongs to a different subject', async () => {
      mockPrisma.topic.findUnique.mockResolvedValueOnce({ subjectId: 2, parentId: null });

      await expect(
        service.createTopic({ subjectId: 1, parentId: 10, name: 'Tense', slug: 'tense' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a sub-topic whose parent is itself a sub-topic (max two levels)', async () => {
      mockPrisma.topic.findUnique.mockResolvedValueOnce({ subjectId: 1, parentId: 3 });

      await expect(
        service.createTopic({ subjectId: 1, parentId: 10, name: 'Tense', slug: 'tense' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects updating a topic to be its own parent', async () => {
      await expect(service.updateTopic(10, { parentId: 10 })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.topic.update).not.toHaveBeenCalled();
    });

    it('looks up the current subjectId when updating parentId without also changing subjectId', async () => {
      mockPrisma.topic.findUniqueOrThrow.mockResolvedValueOnce({ subjectId: 1 });
      mockPrisma.topic.findUnique.mockResolvedValueOnce({ subjectId: 1, parentId: null });
      mockPrisma.topic.update.mockResolvedValueOnce({ id: 2, parentId: 10 });

      await service.updateTopic(2, { parentId: 10 });

      expect(mockPrisma.topic.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 2 } }),
      );
    });

    it('allows clearing parentId (promoting a sub-topic) without a parent lookup', async () => {
      mockPrisma.topic.update.mockResolvedValueOnce({ id: 2, parentId: null });

      await service.updateTopic(2, { parentId: null });

      expect(mockPrisma.topic.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.topic.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { parentId: null } }),
      );
    });

    it('deletes a topic and invalidates the tree cache', async () => {
      mockPrisma.topic.delete.mockResolvedValueOnce({ id: 1 });

      await service.deleteTopic(1);

      expect(mockRedisClient.del).toHaveBeenCalledWith(TAXONOMY_TREE_CACHE_KEY);
    });
  });
});
