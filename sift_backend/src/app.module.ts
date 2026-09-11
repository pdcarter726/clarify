import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RecipesModule } from './recipes/recipes.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ExtractionModule } from './extraction/extraction.module';
import { TagsModule } from './tags/tags.module';

/**
 * Root application module. Wires together the Prisma database layer, auth,
 * and the recipes/users/extraction/tags feature modules.
 */
@Module({
  imports: [
    PrismaModule,
    RecipesModule,
    UsersModule,
    AuthModule,
    ExtractionModule,
    TagsModule,
  ],
})
export class AppModule {}
