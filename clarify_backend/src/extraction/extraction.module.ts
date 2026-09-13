import { Module } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { ExtractionController } from './extraction.controller';
import { PageFetcherService } from './page-fetcher.service';
import { BrowserPageLoader } from './browser-page-loader';

/** Wires up the recipe-URL scraping/extraction feature and exports the service for reuse by other modules. */
@Module({
  providers: [ExtractionService, PageFetcherService, BrowserPageLoader],
  controllers: [ExtractionController],
  exports: [ExtractionService],
})
export class ExtractionModule {}
