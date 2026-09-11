import { Body, Controller, Post } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { ExtractRecipeDto } from './dto/extract-recipe.dto';

/** Endpoint for scraping a recipe from a third-party page URL. */
@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  /** Fetches the given URL and parses its embedded JSON-LD Recipe data. */
  @Post()
  extract(@Body() extractRecipeDto: ExtractRecipeDto) {
    return this.extractionService.extractFromUrl(extractRecipeDto.url);
  }
}
