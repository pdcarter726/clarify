import 'dotenv/config';

// Nutrition is only calculated on request (POST /recipes/:id/nutrition), but
// keep e2e tests from ever depending on real network access to USDA
// FoodData Central: with the key unset, that endpoint deterministically
// returns 503 (real behavior is covered by NutritionService's unit tests).
delete process.env.USDA_FDC_API_KEY;
