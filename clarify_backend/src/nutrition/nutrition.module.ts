import { Module } from '@nestjs/common';
import { NutritionService } from './nutrition.service';

/** Wires up the USDA FoodData Central-backed nutrition calculation service and exports it for use by other modules. */
@Module({
  providers: [NutritionService],
  exports: [NutritionService],
})
export class NutritionModule {}
