import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { TagsModule } from '../tags/tags.module';
import { NutritionModule } from '../nutrition/nutrition.module';

/** Wires up the recipes feature, pulling in Prisma, extraction, tags, and nutrition as dependencies. */
@Module({
  imports: [PrismaModule, ExtractionModule, TagsModule, NutritionModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
