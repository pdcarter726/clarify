import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { ExtractRecipeDto } from '../extraction/dto/extract-recipe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** CRUD and nutrition/import operations on the current user's recipes. All routes require a valid JWT and are scoped to the authenticated user. */
@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  /** Creates a recipe (with optional nested ingredients/instructions/tags) owned by the current user. */
  @Post()
  create(
    @CurrentUser() userId: number,
    @Body() createRecipeDto: CreateRecipeDto,
  ) {
    return this.recipesService.create(userId, createRecipeDto);
  }

  /** Scrapes the given URL via the extraction service and saves the result as a new recipe. */
  @Post('import')
  import(
    @CurrentUser() userId: number,
    @Body() extractRecipeDto: ExtractRecipeDto,
  ) {
    return this.recipesService.importFromUrl(userId, extractRecipeDto.url);
  }

  /** Lists the current user's recipes, optionally filtered by a comma-separated tag list (AND match) and/or a title/ingredient search term. */
  @Get()
  findAll(
    @CurrentUser() userId: number,
    @Query('tags') tags?: string,
    @Query('q') q?: string,
  ) {
    const tagNames = tags
      ? tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined;
    return this.recipesService.findAll(userId, tagNames, q);
  }

  /** Fetches a single recipe by id, scoped to the current user. Returns 404 if not found or not owned by them. */
  @Get(':id')
  findOne(
    @CurrentUser() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.recipesService.findOne(userId, id);
  }

  /** Partially updates a recipe. Any of ingredients/instructions/tags supplied wholesale-replaces the existing set. */
  @Patch(':id')
  update(
    @CurrentUser() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRecipeDto: UpdateRecipeDto,
  ) {
    return this.recipesService.update(userId, id, updateRecipeDto);
  }

  /** Deletes a recipe (and its ingredients/instructions/tag links via cascade). */
  @Delete(':id')
  remove(@CurrentUser() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.recipesService.remove(userId, id);
  }

  /** Looks up nutrition totals for the recipe's ingredients and persists them on the recipe. */
  @Post(':id/nutrition')
  calculateNutrition(
    @CurrentUser() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.recipesService.calculateNutrition(userId, id);
  }
}
