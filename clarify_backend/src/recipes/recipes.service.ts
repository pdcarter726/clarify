import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionService } from '../extraction/extraction.service';
import { TagsService } from '../tags/tags.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

/**
 * Owns recipe CRUD plus the two features that compose other services:
 * importing a recipe from a scraped URL and calculating its nutrition.
 * All queries are scoped to the owning user; cross-user access 404s.
 */
@Injectable()
export class RecipesService {
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractionService: ExtractionService,
    private readonly tagsService: TagsService,
    private readonly nutritionService: NutritionService,
  ) {}

  private readonly include = {
    ingredients: { orderBy: { position: 'asc' as const } },
    instructions: { orderBy: { stepNumber: 'asc' as const } },
    recipeTags: {
      include: { tag: true },
      orderBy: { tag: { name: 'asc' as const } },
    },
  };

  // Flattens the recipeTags join rows into a plain `tags` array on the response.
  private formatRecipe<T extends { recipeTags: { tag: unknown }[] }>(
    recipe: T,
  ) {
    const { recipeTags, ...rest } = recipe;
    return { ...rest, tags: recipeTags.map((recipeTag) => recipeTag.tag) };
  }

  /**
   * Best-effort nutrition calculation run automatically after a recipe is
   * created/imported or its ingredients are edited. Unlike the explicit
   * `calculateNutrition` flow, failures here (no ingredients, USDA not
   * configured, a lookup error) are swallowed rather than thrown — auto-calc
   * is a convenience, not something that should block saving a recipe.
   * Returns the recipe with nutrition applied, or `recipe` unchanged if
   * calculation was skipped/failed.
   */
  private async autoCalculateNutrition<
    T extends { id: number; ingredients: { name: string }[] },
  >(recipe: T): Promise<T> {
    if (recipe.ingredients.length === 0) return recipe;
    try {
      const nutrition = await this.nutritionService.calculateForIngredients(
        recipe.ingredients,
      );
      // Both call sites pass a recipe fetched with `this.include`, so the
      // updated result has the same shape as `T` even though the generic
      // can't express that relationship to the compiler.
      return (await this.prisma.recipe.update({
        where: { id: recipe.id },
        data: nutrition,
        include: this.include,
      })) as unknown as T;
    } catch (error) {
      this.logger.warn(
        `Automatic nutrition calculation skipped for recipe ${recipe.id}: ${(error as Error).message}`,
      );
      return recipe;
    }
  }

  /** Scrapes `url` via ExtractionService and saves the extracted data as a new recipe for `userId`. */
  async importFromUrl(userId: number, url: string) {
    const extracted = await this.extractionService.extractFromUrl(url);
    return this.create(userId, extracted);
  }

  /** Creates a recipe with its nested ingredients/instructions and resolves/attaches any named tags, then auto-calculates nutrition. */
  async create(userId: number, createRecipeDto: CreateRecipeDto) {
    const { ingredients, instructions, tags, ...recipeData } = createRecipeDto;
    const tagIds = tags ? await this.tagsService.resolveTagIds(tags) : [];
    const recipe = await this.prisma.recipe.create({
      data: {
        ...recipeData,
        userId,
        ingredients: ingredients ? { create: ingredients } : undefined,
        instructions: instructions ? { create: instructions } : undefined,
        recipeTags: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: this.include,
    });
    return this.formatRecipe(await this.autoCalculateNutrition(recipe));
  }

  /** Lists a user's recipes; when given, tag names must ALL match (AND) and `q` matches title or ingredient name. */
  async findAll(userId: number, tagNames?: string[], q?: string) {
    const normalizedTags = tagNames
      ? this.tagsService.normalizeNames(tagNames)
      : [];
    const trimmedQuery = q?.trim();

    const recipes = await this.prisma.recipe.findMany({
      where: {
        userId,
        // Every selected tag must match (AND), not just one of them.
        AND: [
          ...normalizedTags.map((name) => ({
            recipeTags: { some: { tag: { name } } },
          })),
          ...(trimmedQuery
            ? [
                {
                  OR: [
                    // Postgres matching is case-sensitive by default.
                    {
                      title: {
                        contains: trimmedQuery,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      ingredients: {
                        some: {
                          name: {
                            contains: trimmedQuery,
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: this.include,
    });
    return recipes.map((recipe) => this.formatRecipe(recipe));
  }

  /**
   * Fetches a single recipe owned by `userId`.
   * @throws NotFoundException if it doesn't exist or belongs to another user.
   */
  async findOne(userId: number, id: number) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, userId },
      include: this.include,
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe ${id} not found`);
    }
    return this.formatRecipe(recipe);
  }

  /**
   * Updates recipe fields. Supplying ingredients/instructions/tags deletes the
   * existing nested rows and recreates them (see inline note) rather than diffing.
   * Re-runs nutrition calculation when `ingredients` is supplied, since that's
   * the only field that can change what it should be.
   */
  async update(userId: number, id: number, updateRecipeDto: UpdateRecipeDto) {
    await this.findOne(userId, id);
    const { ingredients, instructions, tags, ...recipeData } = updateRecipeDto;
    const tagIds = tags
      ? await this.tagsService.resolveTagIds(tags)
      : undefined;
    const recipe = await this.prisma.recipe.update({
      where: { id },
      data: {
        ...recipeData,
        // Nested collections are order-dependent, so replace them wholesale
        // rather than diffing individual ingredients/instructions.
        ingredients: ingredients
          ? { deleteMany: {}, create: ingredients }
          : undefined,
        instructions: instructions
          ? { deleteMany: {}, create: instructions }
          : undefined,
        recipeTags: tagIds
          ? { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: this.include,
    });
    const withNutrition = ingredients
      ? await this.autoCalculateNutrition(recipe)
      : recipe;
    return this.formatRecipe(withNutrition);
  }

  /** Deletes a recipe owned by `userId`; cascades to its ingredients, instructions, and tag links. */
  async remove(userId: number, id: number) {
    await this.findOne(userId, id);
    return this.prisma.recipe.delete({ where: { id } });
  }

  /**
   * Looks up nutrition totals for the recipe's ingredients (via NutritionService)
   * and persists them on the recipe.
   * @throws BadRequestException if the recipe has no ingredients.
   */
  async calculateNutrition(userId: number, id: number) {
    const recipe = await this.findOne(userId, id);
    if (recipe.ingredients.length === 0) {
      throw new BadRequestException(
        'Recipe has no ingredients to calculate nutrition for',
      );
    }
    const nutrition = await this.nutritionService.calculateForIngredients(
      recipe.ingredients,
    );
    const updated = await this.prisma.recipe.update({
      where: { id },
      data: nutrition,
      include: this.include,
    });
    return this.formatRecipe(updated);
  }
}
