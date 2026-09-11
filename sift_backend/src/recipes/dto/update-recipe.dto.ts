import { PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from './create-recipe.dto';

/** Same shape as {@link CreateRecipeDto} but with every field optional, for partial updates. */
export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}
