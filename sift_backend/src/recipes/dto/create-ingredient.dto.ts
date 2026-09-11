import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Validates a single nested ingredient entry within a recipe create/update payload. */
export class CreateIngredientDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
