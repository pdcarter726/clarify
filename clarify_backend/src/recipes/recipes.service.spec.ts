import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionService } from '../extraction/extraction.service';
import { TagsService } from '../tags/tags.service';
import { NutritionService } from '../nutrition/nutrition.service';

describe('RecipesService', () => {
  let service: RecipesService;
  let prisma: {
    recipe: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let extractionService: { extractFromUrl: jest.Mock };
  let tagsService: {
    resolveTagIds: jest.Mock;
    normalizeNames: jest.Mock;
    normalize: jest.Mock;
  };
  let nutritionService: { calculateForIngredients: jest.Mock };

  const include = {
    ingredients: { orderBy: { position: 'asc' } },
    instructions: { orderBy: { stepNumber: 'asc' } },
    recipeTags: { include: { tag: true }, orderBy: { tag: { name: 'asc' } } },
  };

  beforeEach(() => {
    prisma = {
      recipe: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    extractionService = { extractFromUrl: jest.fn() };
    tagsService = {
      resolveTagIds: jest.fn(),
      normalizeNames: jest.fn(),
      normalize: jest.fn(),
    };
    // Rejects by default (mirroring "USDA_FDC_API_KEY not configured") so
    // tests unrelated to nutrition don't need to mock it — auto-calculation
    // silently no-ops on failure. Tests that care about nutrition override this.
    nutritionService = {
      calculateForIngredients: jest
        .fn()
        .mockRejectedValue(new Error('not configured')),
    };
    service = new RecipesService(
      prisma as unknown as PrismaService,
      extractionService as unknown as ExtractionService,
      tagsService as unknown as TagsService,
      nutritionService as unknown as NutritionService,
    );
  });

  describe('create', () => {
    it('creates a recipe with nested ingredients and instructions', async () => {
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients: [{ name: 'water', position: 0 }],
        recipeTags: [],
      });

      await service.create(7, {
        title: 'Soup',
        ingredients: [{ name: 'water', position: 0 }],
        instructions: [{ stepNumber: 1, text: 'Boil' }],
      });

      expect(prisma.recipe.create).toHaveBeenCalledWith({
        data: {
          title: 'Soup',
          userId: 7,
          ingredients: { create: [{ name: 'water', position: 0 }] },
          instructions: { create: [{ stepNumber: 1, text: 'Boil' }] },
          recipeTags: undefined,
        },
        include,
      });
    });

    it('omits nested creates when ingredients/instructions are absent', async () => {
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients: [],
        recipeTags: [],
      });

      await service.create(7, { title: 'Soup' });

      expect(prisma.recipe.create).toHaveBeenCalledWith({
        data: {
          title: 'Soup',
          userId: 7,
          ingredients: undefined,
          instructions: undefined,
          recipeTags: undefined,
        },
        include,
      });
    });

    it('resolves tag names to ids and connects them, flattening tags in the response', async () => {
      tagsService.resolveTagIds.mockResolvedValue([3, 5]);
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients: [],
        recipeTags: [
          { tag: { id: 3, name: 'breakfast' } },
          { tag: { id: 5, name: 'weeknight' } },
        ],
      });

      const result = await service.create(7, {
        title: 'Pancakes',
        tags: ['Breakfast', 'Weeknight'],
      });

      expect(tagsService.resolveTagIds).toHaveBeenCalledWith([
        'Breakfast',
        'Weeknight',
      ]);
      expect(prisma.recipe.create).toHaveBeenCalledWith({
        data: {
          title: 'Pancakes',
          userId: 7,
          ingredients: undefined,
          instructions: undefined,
          recipeTags: { create: [{ tagId: 3 }, { tagId: 5 }] },
        },
        include,
      });
      expect(result).toEqual({
        id: 1,
        ingredients: [],
        tags: [
          { id: 3, name: 'breakfast' },
          { id: 5, name: 'weeknight' },
        ],
      });
    });
  });

  describe('automatic nutrition calculation', () => {
    const ingredients = [{ name: 'flour', quantity: '2', unit: 'cups' }];
    const nutrition = {
      calories: 200,
      proteinGrams: 5,
      fatGrams: 1,
      carbGrams: 40,
    };

    it('calculates and persists nutrition after create when ingredients are given', async () => {
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients,
        recipeTags: [],
      });
      nutritionService.calculateForIngredients.mockResolvedValue(nutrition);
      prisma.recipe.update.mockResolvedValue({
        id: 1,
        ingredients,
        recipeTags: [],
        ...nutrition,
      });

      const result = await service.create(7, {
        title: 'Pancakes',
        ingredients,
      });

      expect(nutritionService.calculateForIngredients).toHaveBeenCalledWith(
        ingredients,
      );
      expect(prisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: nutrition,
        include,
      });
      expect(result).toMatchObject(nutrition);
    });

    it('skips nutrition calculation on create when no ingredients are given', async () => {
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients: [],
        recipeTags: [],
      });

      await service.create(7, { title: 'Pancakes' });

      expect(nutritionService.calculateForIngredients).not.toHaveBeenCalled();
      expect(prisma.recipe.update).not.toHaveBeenCalled();
    });

    it('still returns the recipe from create when nutrition calculation fails', async () => {
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients,
        recipeTags: [],
      });
      nutritionService.calculateForIngredients.mockRejectedValue(
        new Error('USDA down'),
      );

      const result = await service.create(7, {
        title: 'Pancakes',
        ingredients,
      });

      expect(result).toEqual({ id: 1, ingredients, tags: [] });
      expect(prisma.recipe.update).not.toHaveBeenCalled();
    });

    it('recalculates nutrition on update when ingredients are supplied', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [],
      });
      prisma.recipe.update
        .mockResolvedValueOnce({ id: 1, ingredients, recipeTags: [] })
        .mockResolvedValueOnce({
          id: 1,
          ingredients,
          recipeTags: [],
          ...nutrition,
        });
      nutritionService.calculateForIngredients.mockResolvedValue(nutrition);

      const result = await service.update(7, 1, { ingredients });

      expect(nutritionService.calculateForIngredients).toHaveBeenCalledWith(
        ingredients,
      );
      expect(prisma.recipe.update).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject(nutrition);
    });

    it('does not recalculate nutrition on update when ingredients are not supplied', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [],
      });
      prisma.recipe.update.mockResolvedValue({ id: 1, recipeTags: [] });

      await service.update(7, 1, { title: 'New title' });

      expect(nutritionService.calculateForIngredients).not.toHaveBeenCalled();
      expect(prisma.recipe.update).toHaveBeenCalledTimes(1);
    });

    it('calculates nutrition for a recipe imported from a URL', async () => {
      extractionService.extractFromUrl.mockResolvedValue({
        title: 'Fixture Pancakes',
        ingredients,
      });
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ingredients,
        recipeTags: [],
      });
      nutritionService.calculateForIngredients.mockResolvedValue(nutrition);
      prisma.recipe.update.mockResolvedValue({
        id: 1,
        ingredients,
        recipeTags: [],
        ...nutrition,
      });

      const result = await service.importFromUrl(7, 'https://example.com');

      expect(nutritionService.calculateForIngredients).toHaveBeenCalledWith(
        ingredients,
      );
      expect(result).toMatchObject(nutrition);
    });
  });

  describe('findAll', () => {
    it('scopes the query to the given userId with no tag filter', async () => {
      prisma.recipe.findMany.mockResolvedValue([]);

      await service.findAll(7);

      expect(prisma.recipe.findMany).toHaveBeenCalledWith({
        where: { userId: 7, AND: [] },
        include,
      });
      expect(tagsService.normalizeNames).not.toHaveBeenCalled();
    });

    it('requires every selected tag to match (AND, not OR)', async () => {
      tagsService.normalizeNames.mockReturnValue(['breakfast', 'dinner']);
      prisma.recipe.findMany.mockResolvedValue([
        {
          id: 1,
          recipeTags: [
            { tag: { id: 3, name: 'breakfast' } },
            { tag: { id: 4, name: 'dinner' } },
          ],
        },
      ]);

      const result = await service.findAll(7, ['Breakfast', 'Dinner']);

      expect(tagsService.normalizeNames).toHaveBeenCalledWith([
        'Breakfast',
        'Dinner',
      ]);
      expect(prisma.recipe.findMany).toHaveBeenCalledWith({
        where: {
          userId: 7,
          AND: [
            { recipeTags: { some: { tag: { name: 'breakfast' } } } },
            { recipeTags: { some: { tag: { name: 'dinner' } } } },
          ],
        },
        include,
      });
      expect(result).toEqual([
        {
          id: 1,
          tags: [
            { id: 3, name: 'breakfast' },
            { id: 4, name: 'dinner' },
          ],
        },
      ]);
    });

    it('filters by a search query matching the title or an ingredient name', async () => {
      prisma.recipe.findMany.mockResolvedValue([]);

      await service.findAll(7, undefined, 'chicken');

      expect(prisma.recipe.findMany).toHaveBeenCalledWith({
        where: {
          userId: 7,
          AND: [
            {
              OR: [
                { title: { contains: 'chicken', mode: 'insensitive' } },
                {
                  ingredients: {
                    some: {
                      name: { contains: 'chicken', mode: 'insensitive' },
                    },
                  },
                },
              ],
            },
          ],
        },
        include,
      });
    });

    it('ignores a blank or whitespace-only search query', async () => {
      prisma.recipe.findMany.mockResolvedValue([]);

      await service.findAll(7, undefined, '   ');

      expect(prisma.recipe.findMany).toHaveBeenCalledWith({
        where: { userId: 7, AND: [] },
        include,
      });
    });

    it('combines tag filters and a search query', async () => {
      tagsService.normalizeNames.mockReturnValue(['dinner']);
      prisma.recipe.findMany.mockResolvedValue([]);

      await service.findAll(7, ['Dinner'], 'chicken');

      expect(prisma.recipe.findMany).toHaveBeenCalledWith({
        where: {
          userId: 7,
          AND: [
            { recipeTags: { some: { tag: { name: 'dinner' } } } },
            {
              OR: [
                { title: { contains: 'chicken', mode: 'insensitive' } },
                {
                  ingredients: {
                    some: {
                      name: { contains: 'chicken', mode: 'insensitive' },
                    },
                  },
                },
              ],
            },
          ],
        },
        include,
      });
    });
  });

  describe('findOne', () => {
    it('returns the recipe when it belongs to the user, with tags flattened', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [{ tag: { id: 3, name: 'breakfast' } }],
      });

      const result = await service.findOne(7, 1);

      expect(prisma.recipe.findFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 7 },
        include,
      });
      expect(result).toEqual({
        id: 1,
        userId: 7,
        tags: [{ id: 3, name: 'breakfast' }],
      });
    });

    it('throws NotFoundException when the recipe belongs to a different user or does not exist', async () => {
      prisma.recipe.findFirst.mockResolvedValue(null);

      await expect(service.findOne(7, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException before updating when ownership check fails', async () => {
      prisma.recipe.findFirst.mockResolvedValue(null);

      await expect(service.update(7, 1, { title: 'New' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.recipe.update).not.toHaveBeenCalled();
    });

    it('replaces ingredients and instructions wholesale when provided', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [],
      });
      prisma.recipe.update.mockResolvedValue({
        id: 1,
        ingredients: [{ name: 'salt', position: 0 }],
        recipeTags: [],
      });

      await service.update(7, 1, {
        title: 'New',
        ingredients: [{ name: 'salt', position: 0 }],
        instructions: [{ stepNumber: 1, text: 'Stir' }],
      });

      expect(prisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          title: 'New',
          ingredients: {
            deleteMany: {},
            create: [{ name: 'salt', position: 0 }],
          },
          instructions: {
            deleteMany: {},
            create: [{ stepNumber: 1, text: 'Stir' }],
          },
          recipeTags: undefined,
        },
        include,
      });
    });

    it('leaves ingredients/instructions/tags untouched when not provided', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [],
      });
      prisma.recipe.update.mockResolvedValue({ id: 1, recipeTags: [] });

      await service.update(7, 1, { title: 'New' });

      expect(prisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          title: 'New',
          ingredients: undefined,
          instructions: undefined,
          recipeTags: undefined,
        },
        include,
      });
      expect(tagsService.resolveTagIds).not.toHaveBeenCalled();
    });

    it('replaces tags wholesale when provided', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [],
      });
      tagsService.resolveTagIds.mockResolvedValue([9]);
      prisma.recipe.update.mockResolvedValue({
        id: 1,
        recipeTags: [{ tag: { id: 9, name: 'one pot' } }],
      });

      const result = await service.update(7, 1, { tags: ['One Pot'] });

      expect(tagsService.resolveTagIds).toHaveBeenCalledWith(['One Pot']);
      expect(prisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          ingredients: undefined,
          instructions: undefined,
          recipeTags: { deleteMany: {}, create: [{ tagId: 9 }] },
        },
        include,
      });
      expect(result).toEqual({ id: 1, tags: [{ id: 9, name: 'one pot' }] });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException before deleting when ownership check fails', async () => {
      prisma.recipe.findFirst.mockResolvedValue(null);

      await expect(service.remove(7, 1)).rejects.toThrow(NotFoundException);
      expect(prisma.recipe.delete).not.toHaveBeenCalled();
    });

    it('deletes the recipe when owned by the user', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        recipeTags: [],
      });
      prisma.recipe.delete.mockResolvedValue({ id: 1 });

      const result = await service.remove(7, 1);

      expect(prisma.recipe.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('importFromUrl', () => {
    it('extracts the recipe from the url and saves it for the user', async () => {
      const extracted = {
        title: 'Fixture Pancakes',
        sourceUrl: 'https://example.com',
        ingredients: [{ name: 'flour', position: 0 }],
        instructions: [{ stepNumber: 1, text: 'Mix' }],
      };
      extractionService.extractFromUrl.mockResolvedValue(extracted);
      prisma.recipe.create.mockResolvedValue({
        id: 1,
        ...extracted,
        recipeTags: [],
      });

      const result = await service.importFromUrl(7, 'https://example.com');

      expect(extractionService.extractFromUrl).toHaveBeenCalledWith(
        'https://example.com',
      );
      expect(prisma.recipe.create).toHaveBeenCalledWith({
        data: {
          title: 'Fixture Pancakes',
          sourceUrl: 'https://example.com',
          userId: 7,
          ingredients: { create: [{ name: 'flour', position: 0 }] },
          instructions: { create: [{ stepNumber: 1, text: 'Mix' }] },
          recipeTags: undefined,
        },
        include,
      });
      expect(result).toEqual({ id: 1, ...extracted, tags: [] });
    });
  });

  describe('calculateNutrition', () => {
    it('throws BadRequestException when the recipe has no ingredients', async () => {
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        ingredients: [],
        recipeTags: [],
      });

      await expect(service.calculateNutrition(7, 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(nutritionService.calculateForIngredients).not.toHaveBeenCalled();
    });

    it('calculates nutrition from the recipe ingredients and persists it', async () => {
      const ingredients = [
        { id: 1, name: 'flour', quantity: '2', unit: 'cups' },
      ];
      prisma.recipe.findFirst.mockResolvedValue({
        id: 1,
        userId: 7,
        ingredients,
        recipeTags: [],
      });
      nutritionService.calculateForIngredients.mockResolvedValue({
        calories: 300.5,
        proteinGrams: 6.1,
        fatGrams: 2.6,
        carbGrams: 40.3,
      });
      prisma.recipe.update.mockResolvedValue({
        id: 1,
        calories: 300.5,
        proteinGrams: 6.1,
        fatGrams: 2.6,
        carbGrams: 40.3,
        recipeTags: [],
      });

      const result = await service.calculateNutrition(7, 1);

      expect(nutritionService.calculateForIngredients).toHaveBeenCalledWith(
        ingredients,
      );
      expect(prisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          calories: 300.5,
          proteinGrams: 6.1,
          fatGrams: 2.6,
          carbGrams: 40.3,
        },
        include,
      });
      expect(result).toEqual({
        id: 1,
        calories: 300.5,
        proteinGrams: 6.1,
        fatGrams: 2.6,
        carbGrams: 40.3,
        tags: [],
      });
    });
  });
});
