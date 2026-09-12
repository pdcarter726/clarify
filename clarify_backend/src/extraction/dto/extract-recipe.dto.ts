import { IsUrl } from 'class-validator';

/** Validates the source page URL submitted for recipe extraction. */
export class ExtractRecipeDto {
  @IsUrl()
  url: string;
}
