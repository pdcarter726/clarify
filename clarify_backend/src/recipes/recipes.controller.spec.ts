import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

describe('RecipesController', () => {
  let controller: RecipesController;
  let recipesService: {
    create: jest.Mock;
    importFromUrl: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    calculateNutrition: jest.Mock;
  };

  beforeEach(() => {
    recipesService = {
      create: jest.fn(),
      importFromUrl: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      calculateNutrition: jest.fn(),
    };
    controller = new RecipesController(
      recipesService as unknown as RecipesService,
    );
  });

  it('create delegates with the current user id', () => {
    const dto = { title: 'Soup' };
    controller.create(7, dto);
    expect(recipesService.create).toHaveBeenCalledWith(7, dto);
  });

  it('import delegates to importFromUrl with the current user id and url', () => {
    controller.import(7, { url: 'https://example.com' });
    expect(recipesService.importFromUrl).toHaveBeenCalledWith(
      7,
      'https://example.com',
    );
  });

  it('findAll delegates with the current user id and no tag filter or search query', () => {
    controller.findAll(7);
    expect(recipesService.findAll).toHaveBeenCalledWith(
      7,
      undefined,
      undefined,
    );
  });

  it('findAll parses a comma-separated tags query param into a trimmed list', () => {
    controller.findAll(7, 'Breakfast, one pot ,,dinner');
    expect(recipesService.findAll).toHaveBeenCalledWith(
      7,
      ['Breakfast', 'one pot', 'dinner'],
      undefined,
    );
  });

  it('findAll passes the search query through', () => {
    controller.findAll(7, undefined, 'chicken');
    expect(recipesService.findAll).toHaveBeenCalledWith(
      7,
      undefined,
      'chicken',
    );
  });

  it('findOne delegates with the current user id and recipe id', () => {
    controller.findOne(7, 3);
    expect(recipesService.findOne).toHaveBeenCalledWith(7, 3);
  });

  it('update delegates with the current user id, recipe id, and dto', () => {
    const dto = { title: 'New' };
    controller.update(7, 3, dto);
    expect(recipesService.update).toHaveBeenCalledWith(7, 3, dto);
  });

  it('remove delegates with the current user id and recipe id', () => {
    controller.remove(7, 3);
    expect(recipesService.remove).toHaveBeenCalledWith(7, 3);
  });

  it('calculateNutrition delegates with the current user id and recipe id', () => {
    controller.calculateNutrition(7, 3);
    expect(recipesService.calculateNutrition).toHaveBeenCalledWith(7, 3);
  });
});
