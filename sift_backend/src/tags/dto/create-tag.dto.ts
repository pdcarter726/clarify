import { IsString, MinLength } from 'class-validator';

/** Validates the name payload for creating or renaming a tag. */
export class CreateTagDto {
  @IsString()
  @MinLength(1)
  name: string;
}
