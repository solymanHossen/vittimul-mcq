import { Test, type TestingModule } from '@nestjs/testing';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';

const mockTaxonomyService = {
  getTree: jest.fn(),
  listCategories: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  listSubjects: jest.fn(),
  createSubject: jest.fn(),
  updateSubject: jest.fn(),
  deleteSubject: jest.fn(),
  listTopics: jest.fn(),
  createTopic: jest.fn(),
  updateTopic: jest.fn(),
  deleteTopic: jest.fn(),
};

describe('TaxonomyController', () => {
  let controller: TaxonomyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyController],
      providers: [{ provide: TaxonomyService, useValue: mockTaxonomyService }],
    }).compile();

    controller = module.get<TaxonomyController>(TaxonomyController);
    jest.clearAllMocks();
  });

  it('getTree() returns the tree wrapped in a success envelope', async () => {
    mockTaxonomyService.getTree.mockResolvedValueOnce([{ id: 1 }]);

    const result = await controller.getTree();

    expect(result).toEqual({
      message: 'Taxonomy tree retrieved successfully',
      data: [{ id: 1 }],
    });
  });

  describe('categories', () => {
    const category = {
      id: 1,
      name: 'Bank Job',
      slug: 'bank-job',
      description: null,
      iconUrl: null,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('listCategories() maps rows into CategoryEntity instances', async () => {
      mockTaxonomyService.listCategories.mockResolvedValueOnce([category]);

      const result = await controller.listCategories();

      expect(result.data).toEqual([category]);
    });

    it('createCategory() delegates to the service', async () => {
      mockTaxonomyService.createCategory.mockResolvedValueOnce(category);
      const dto = { name: 'Bank Job', slug: 'bank-job' };

      const result = await controller.createCategory(dto);

      expect(mockTaxonomyService.createCategory).toHaveBeenCalledWith(dto);
      expect(result.data).toEqual(category);
    });

    it('updateCategory() passes the numeric id and dto through', async () => {
      mockTaxonomyService.updateCategory.mockResolvedValueOnce(category);

      await controller.updateCategory(1, { name: 'Renamed' });

      expect(mockTaxonomyService.updateCategory).toHaveBeenCalledWith(1, { name: 'Renamed' });
    });

    it('deleteCategory() returns a null-data success envelope', async () => {
      mockTaxonomyService.deleteCategory.mockResolvedValueOnce(undefined);

      const result = await controller.deleteCategory(1);

      expect(mockTaxonomyService.deleteCategory).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Category deleted successfully', data: null });
    });
  });

  describe('subjects', () => {
    it('listSubjects() forwards the parsed query to the service', async () => {
      mockTaxonomyService.listSubjects.mockResolvedValueOnce([]);

      await controller.listSubjects({ categoryId: 2 });

      expect(mockTaxonomyService.listSubjects).toHaveBeenCalledWith({ categoryId: 2 });
    });

    it('createSubject() delegates to the service', async () => {
      const dto = { categoryId: 1, name: 'English', slug: 'english' };
      mockTaxonomyService.createSubject.mockResolvedValueOnce({ id: 1, ...dto });

      await controller.createSubject(dto);

      expect(mockTaxonomyService.createSubject).toHaveBeenCalledWith(dto);
    });

    it('deleteSubject() returns a null-data success envelope', async () => {
      const result = await controller.deleteSubject(1);

      expect(mockTaxonomyService.deleteSubject).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Subject deleted successfully', data: null });
    });
  });

  describe('topics', () => {
    it('listTopics() forwards the parsed query to the service', async () => {
      mockTaxonomyService.listTopics.mockResolvedValueOnce([]);

      await controller.listTopics({ parentId: 'root' });

      expect(mockTaxonomyService.listTopics).toHaveBeenCalledWith({ parentId: 'root' });
    });

    it('createTopic() delegates to the service', async () => {
      const dto = { subjectId: 1, name: 'Grammar', slug: 'grammar' };
      mockTaxonomyService.createTopic.mockResolvedValueOnce({ id: 1, ...dto, parentId: null });

      await controller.createTopic(dto);

      expect(mockTaxonomyService.createTopic).toHaveBeenCalledWith(dto);
    });

    it('updateTopic() passes the numeric id and dto through', async () => {
      mockTaxonomyService.updateTopic.mockResolvedValueOnce({ id: 1 });

      await controller.updateTopic(1, { parentId: null });

      expect(mockTaxonomyService.updateTopic).toHaveBeenCalledWith(1, { parentId: null });
    });

    it('deleteTopic() returns a null-data success envelope', async () => {
      const result = await controller.deleteTopic(1);

      expect(mockTaxonomyService.deleteTopic).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Topic deleted successfully', data: null });
    });
  });
});
