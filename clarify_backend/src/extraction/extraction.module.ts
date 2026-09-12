import { Module } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { ExtractionController } from './extraction.controller';

/** Wires up the recipe-URL scraping/extraction feature and exports the service for reuse by other modules. */
@Module({
  providers: [ExtractionService],
  controllers: [ExtractionController],
  exports: [ExtractionService],
})
export class ExtractionModule {}
