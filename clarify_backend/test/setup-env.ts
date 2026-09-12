import 'dotenv/config';

// Recipe create/update now trigger automatic nutrition calculation, which
// would otherwise make e2e tests depend on real network access to USDA
// FoodData Central. Unset the key so it deterministically takes the fast
// "not configured" skip path instead (real behavior is covered by
// NutritionService's own unit tests).
delete process.env.USDA_FDC_API_KEY;
