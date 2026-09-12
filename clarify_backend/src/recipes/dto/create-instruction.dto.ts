import { IsInt, IsString, Min } from 'class-validator';

/** Validates a single nested instruction step (1-based `stepNumber`) within a recipe create/update payload. */
export class CreateInstructionDto {
  @IsInt()
  @Min(1)
  stepNumber: number;

  @IsString()
  text: string;
}
