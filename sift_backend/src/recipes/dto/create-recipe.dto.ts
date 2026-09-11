import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { CreateIngredientDto } from './create-ingredient.dto';
import { CreateInstructionDto } from './create-instruction.dto';

/** Validates the payload for creating a recipe, including its optional nested ingredients, instructions, and tag names. */
export class CreateRecipeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  servings?: string;

  @IsOptional()
  @IsString()
  prepTime?: string;

  @IsOptional()
  @IsString()
  cookTime?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIngredientDto)
  ingredients?: CreateIngredientDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInstructionDto)
  instructions?: CreateInstructionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
