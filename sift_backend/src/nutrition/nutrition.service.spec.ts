import { ServiceUnavailableException } from '@nestjs/common';
import { NutritionService } from './nutrition.service';
import { NutritionTotals } from './nutrition.types';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

/** Minimal USDA FDC search result: one food with the given fdcId. */
function searchResult(fdcId: number) {
  return { foods: [{ fdcId, description: 'test food' }] };
}

/**
 * USDA FDC search result with multiple ranked candidates, each carrying its
 * own inline nutrients (the search endpoint's flat `nutrientNumber`/`value`
 * shape) — used to test candidate selection, which now happens from this
 * inline data rather than by fetching each candidate's detail in turn.
 */
function multiSearchResultWithNutrients(
  candidates: {
    fdcId: number;
    nutrients: Partial<Record<keyof NutritionTotals, number>>;
  }[],
) {
  return {
    foods: candidates.map(({ fdcId, nutrients }) => ({
      fdcId,
      description: 'test food',
      foodNutrients: (
        Object.entries(nutrients) as [keyof NutritionTotals, number][]
      ).map(([field, value]) => ({
        nutrientNumber: NUTRIENT_NUMBER_BY_FIELD[field],
        value,
      })),
    })),
  };
}

const ZERO: NutritionTotals = {
  calories: 0,
  proteinGrams: 0,
  fatGrams: 0,
  saturatedFatGrams: 0,
  transFatGrams: 0,
  cholesterolMg: 0,
  sodiumMg: 0,
  carbGrams: 0,
  fiberGrams: 0,
  sugarGrams: 0,
  vitaminDMcg: 0,
  calciumMg: 0,
  ironMg: 0,
  potassiumMg: 0,
};

// USDA nutrient numbers, mirroring NUTRIENT_FIELD_MAP in nutrition.service.ts.
const NUTRIENT_NUMBER_BY_FIELD: Record<keyof NutritionTotals, string> = {
  calories: '208',
  proteinGrams: '203',
  fatGrams: '204',
  saturatedFatGrams: '606',
  transFatGrams: '605',
  cholesterolMg: '601',
  sodiumMg: '307',
  carbGrams: '205',
  fiberGrams: '291',
  sugarGrams: '269',
  vitaminDMcg: '328',
  calciumMg: '301',
  ironMg: '303',
  potassiumMg: '306',
};

/** Minimal USDA FDC food-detail response with per-100g nutrients and optional portions. */
function foodDetail(
  nutrients: Partial<Record<keyof NutritionTotals, number>>,
  portions: {
    modifier?: string;
    measureUnitName?: string;
    gramWeight: number;
  }[] = [],
) {
  const entries = (
    Object.entries(nutrients) as [keyof NutritionTotals, number][]
  ).map(([field, amount]) => ({
    nutrient: { number: NUTRIENT_NUMBER_BY_FIELD[field] },
    amount,
  }));

  return {
    foodNutrients: entries,
    foodPortions: portions.map((p) => ({
      gramWeight: p.gramWeight,
      modifier: p.modifier,
      measureUnit: p.measureUnitName ? { name: p.measureUnitName } : undefined,
    })),
  };
}

describe('NutritionService', () => {
  let service: NutritionService;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    service = new NutritionService();
    process.env.USDA_FDC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('throws ServiceUnavailableException when USDA_FDC_API_KEY is not configured', async () => {
    delete process.env.USDA_FDC_API_KEY;

    await expect(
      service.calculateForIngredients([
        { name: 'flour', quantity: '2', unit: 'cups' },
      ]),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('treats an ingredient as zero (without failing the request) when the fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await service.calculateForIngredients([{ name: 'flour' }]);

    expect(result).toEqual(ZERO);
  });

  it('treats an ingredient as zero (without failing the request) when a USDA request is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 401));

    const result = await service.calculateForIngredients([{ name: 'flour' }]);

    expect(result).toEqual(ZERO);
  });

  it('does not let one failing ingredient zero out the rest of the recipe', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('query=butter')) {
        // USDA's gateway 400s on parenthesized queries; simulate a name that
        // slipped through unsanitized.
        return Promise.resolve(jsonResponse({}, false, 400));
      }
      if (url.includes('/foods/search')) {
        return Promise.resolve(jsonResponse(searchResult(1)));
      }
      return Promise.resolve(jsonResponse(foodDetail({ calories: 100 })));
    }) as unknown as typeof fetch;

    const result = await service.calculateForIngredients([
      { name: 'butter' },
      { name: 'flour' },
    ]);

    expect(result.calories).toBe(100);
  });

  it('strips parenthetical asides from the query, since USDA rejects any query containing parentheses', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ foods: [] }));
    global.fetch = fetchMock;

    await service.calculateForIngredients([
      { name: 'butter (, cut into large cubes or slices)' },
    ]);

    const [url] = fetchMock.mock.calls[0] as [string];
    const query = new URL(url).searchParams.get('query');
    expect(query).toBe('butter');
  });

  it.each(['chopped chocolate', 'minced garlic', 'shredded chicken'])(
    'strips "chopped"/"minced"/"shredded" from the query %s, since USDA\'s search jumps to an unrelated meat/cheese match with them present',
    async (name) => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ foods: [] }));
      global.fetch = fetchMock;

      await service.calculateForIngredients([{ name }]);

      const [url] = fetchMock.mock.calls[0] as [string];
      const query = new URL(url).searchParams.get('query');
      expect(query).not.toMatch(/chopped|minced|shredded/i);
    },
  );

  it('searches Foundation/SR Legacy data with the ingredient name and API key', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ foods: [] }));
    global.fetch = fetchMock;

    await service.calculateForIngredients([{ name: 'all-purpose flour' }]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/foods/search?');
    expect(url).toContain('query=all-purpose+flour');
    expect(url).toContain('api_key=test-api-key');
    expect(url).toContain('dataType=Foundation%2CSR+Legacy');
  });

  it('treats an ingredient with no FDC match as zero nutrition', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ foods: [] }));

    const result = await service.calculateForIngredients([
      { name: 'mystery item' },
    ]);

    expect(result).toEqual(ZERO);
  });

  it('scales every nutrient (not just calories/macros) by a mass-unit quantity converted to grams', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(
        jsonResponse(
          foodDetail({
            calories: 200,
            proteinGrams: 10,
            fatGrams: 4,
            saturatedFatGrams: 1,
            transFatGrams: 0,
            cholesterolMg: 5,
            sodiumMg: 50,
            carbGrams: 20,
            fiberGrams: 2,
            sugarGrams: 3,
            vitaminDMcg: 0.5,
            calciumMg: 40,
            ironMg: 1,
            potassiumMg: 100,
          }),
        ),
      );
    global.fetch = fetchMock;

    // 200g at the per-100g values above => everything doubles.
    const result = await service.calculateForIngredients([
      { name: 'chicken breast', quantity: '200', unit: 'g' },
    ]);

    expect(result).toEqual({
      calories: 400,
      proteinGrams: 20,
      fatGrams: 8,
      saturatedFatGrams: 2,
      transFatGrams: 0,
      cholesterolMg: 10,
      sodiumMg: 100,
      carbGrams: 40,
      fiberGrams: 4,
      sugarGrams: 6,
      vitaminDMcg: 1,
      calciumMg: 80,
      ironMg: 2,
      potassiumMg: 200,
    });
  });

  it('falls back to nutrient number 957 (Atwater General Factors) for calories when 208 is absent', async () => {
    // Newer USDA Foundation Foods entries (e.g. "Chicken, breast, boneless,
    // skinless, raw") omit "208" entirely and report energy only as
    // "957"/"958" — without a fallback, calories silently comes back as 0
    // even though the food has real protein/fat/carb data.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(
        jsonResponse({
          foodNutrients: [
            { nutrient: { number: '957' }, amount: 106 },
            { nutrient: { number: '958' }, amount: 112 },
            { nutrient: { number: '203' }, amount: 22.5 },
          ],
        }),
      );
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'chicken breast', quantity: '100', unit: 'g' },
    ]);

    expect(result.calories).toBe(106);
    expect(result.proteinGrams).toBe(22.5);
  });

  it('skips a top-ranked search candidate with no calorie data and uses the next complete one, from search data alone', async () => {
    // Some highly-ranked USDA entries (e.g. a recently-added Foundation Food
    // with only a partial lab-analysis rollup) have no energy value under
    // any nutrient number at all. Blindly using the top match would report
    // near-zero nutrition for a well-known ingredient that USDA does have
    // complete data for, just ranked second. Candidate selection reads the
    // search response's own inline nutrients (no per-candidate detail
    // fetch), so only one detail request should ever be made — for the
    // winner.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          multiSearchResultWithNutrients([
            { fdcId: 1, nutrients: { saturatedFatGrams: 0.7 } }, // incomplete
            { fdcId: 2, nutrients: { calories: 165, proteinGrams: 31 } },
          ]),
        ),
      )
      // Only the winner (candidate 2) gets a detail fetch.
      .mockResolvedValueOnce(
        jsonResponse(foodDetail({ calories: 165, proteinGrams: 31 })),
      );
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'chicken breast', quantity: '100', unit: 'g' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [detailUrl] = fetchMock.mock.calls[1] as [string];
    expect(detailUrl).toContain('/food/2');
    expect(result.calories).toBe(165);
    expect(result.proteinGrams).toBe(31);
  });

  it("falls back to the top match's own detail when no candidate has calorie data in search results", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          multiSearchResultWithNutrients([
            { fdcId: 1, nutrients: { saturatedFatGrams: 0.7 } },
            { fdcId: 2, nutrients: { transFatGrams: 0.1 } },
          ]),
        ),
      )
      // Falls back to fetching the top match (candidate 1)'s own detail.
      .mockResolvedValueOnce(
        jsonResponse(foodDetail({ saturatedFatGrams: 0.7 })),
      );
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'mystery cut', quantity: '100', unit: 'g' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [detailUrl] = fetchMock.mock.calls[1] as [string];
    expect(detailUrl).toContain('/food/1');
    // Falls back to the first candidate's (incomplete) data rather than erroring.
    expect(result.calories).toBe(0);
    expect(result.saturatedFatGrams).toBe(0.7);
  });

  it('prefers a matching USDA foodPortion over the fixed volume conversion', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(2)))
      .mockResolvedValueOnce(
        jsonResponse(
          foodDetail({ calories: 100 }, [
            { measureUnitName: 'cup', gramWeight: 200 },
          ]),
        ),
      );
    global.fetch = fetchMock;

    // 1 cup with a food-specific portion of 200g => 100 kcal/100g * 200g = 200 kcal.
    const result = await service.calculateForIngredients([
      { name: 'chopped kale', quantity: '1', unit: 'cup' },
    ]);

    expect(result.calories).toBe(200);
  });

  it('uses a dry-goods density estimate for a cup of flour instead of water density, when USDA has no cup portion for it', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 364 }))); // no foodPortions at all
    global.fetch = fetchMock;

    // 1 cup flour ~= 125g (not water's 236.588g) => 364 kcal/100g * 1.25 ~= 455 kcal, not ~861.
    const result = await service.calculateForIngredients([
      { name: 'all-purpose flour', quantity: '1', unit: 'cup' },
    ]);

    expect(result.calories).toBe(455);
  });

  it('scales the dry-goods density estimate down for a tablespoon, not just a full cup', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 228 })));
    global.fetch = fetchMock;

    // 1 tbsp cocoa powder = (14.7868/236.588) of a cup ~= 5.25g of the 84g/cup estimate.
    const result = await service.calculateForIngredients([
      { name: 'cocoa powder', quantity: '1', unit: 'tablespoon' },
    ]);

    expect(result.calories).toBeCloseTo(
      (228 * (84 * (14.7868 / 236.588))) / 100,
      0,
    );
  });

  it('uses a real gram weight for a garlic clove instead of the flat 100g guess', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 149 })));
    global.fetch = fetchMock;

    // 1 clove ~= 3g, not 100g => 149 kcal/100g * 0.03 ~= 4.5 kcal, not ~149.
    const result = await service.calculateForIngredients([
      { name: 'garlic', quantity: '1', unit: 'clove' },
    ]);

    expect(result.calories).toBeCloseTo(4.5, 1);
  });

  it('uses a real gram weight for a counted staple instead of the flat 100g guess when no unit is given', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 40 }))); // no foodPortions
    global.fetch = fetchMock;

    // 1 onion ~= 110g, not 100g => 40 kcal/100g * 1.1 = 44 kcal.
    const result = await service.calculateForIngredients([
      { name: 'onion', quantity: '1' },
    ]);

    expect(result.calories).toBe(44);
  });

  it("hardcodes egg (whole/yolk/white) nutrition rather than searching, since USDA's own egg fdcIds 404 on the detail endpoint", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'large egg', quantity: '1' }, // whole egg: 50g @ 143 kcal/100g
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.calories).toBe(71.5);
  });

  it('uses yolk/white-specific gram weights, not the whole-egg weight, for "egg yolk"/"egg white"', async () => {
    const yolkResult = await service.calculateForIngredients([
      { name: 'large egg yolk', quantity: '1' }, // 18g @ 322 kcal/100g
    ]);
    const whiteResult = await service.calculateForIngredients([
      { name: 'large egg white', quantity: '1' }, // 33g @ 52 kcal/100g
    ]);

    expect(yolkResult.calories).toBeCloseTo(57.96, 1);
    expect(whiteResult.calories).toBeCloseTo(17.16, 1);
  });

  it('hardcodes salt sodium rather than searching, since "kosher salt"/"sea salt" searches rank dill pickles above actual salt', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'kosher salt', quantity: '1', unit: 'teaspoon' },
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    // 1 tsp ~= 4.93g @ 38758 mg sodium/100g ~= 1911 mg.
    expect(result.sodiumMg).toBeCloseTo(1911, -1);
    expect(result.calories).toBe(0);
  });

  it('fully strips nested parentheses instead of leaving a stray ")" that still trips USDA\'s rejection', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ foods: [] }));
    global.fetch = fetchMock;

    await service.calculateForIngredients([
      { name: 'cold butter (sliced into 1/2 inch (1.25 cm) cubes)' },
    ]);

    const [url] = fetchMock.mock.calls[0] as [string];
    const query = new URL(url).searchParams.get('query');
    expect(query).toBe('cold butter');
  });

  it('appends "baking" to a bare chocolate query, since USDA ranks chocolate syrup above solid chocolate otherwise', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ foods: [] }));
    global.fetch = fetchMock;

    await service.calculateForIngredients([{ name: 'chocolate' }]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('query')).toBe('chocolate baking');
  });

  it("falls back to the search response's own nutrient data when the winning candidate's detail fetch fails", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          multiSearchResultWithNutrients([
            { fdcId: 1, nutrients: { calories: 200 } },
          ]),
        ),
      )
      // The detail endpoint 404s on this fdcId even though search returned it.
      .mockResolvedValueOnce(jsonResponse({}, false, 404));
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'test food', quantity: '100', unit: 'g' },
    ]);

    expect(result.calories).toBe(200);
  });

  it('treats an explicitly "to taste"/"optional" ingredient with no quantity as negligible, not a full 100g', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 300 })));
    global.fetch = fetchMock;

    const result = await service.calculateForIngredients([
      { name: 'sugar (if needed, optional)' },
    ]);

    // 2g @ 300 kcal/100g = 6 kcal, not 300.
    expect(result.calories).toBe(6);
  });

  it('uses a realistic package size for a container/can unit instead of a single-piece or flat 100g weight', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 18 }))); // no foodPortions
    global.fetch = fetchMock;

    // 2 cans @ 411g each @ 18 kcal/100g ~= 148 kcal (a can is not one ~123g tomato).
    const result = await service.calculateForIngredients([
      { name: 'whole peeled tomatoes', quantity: '2', unit: 'cans' },
    ]);

    expect(result.calories).toBeCloseTo(147.96, 1);
  });

  it('uses a realistic container size from the name when no unit is given', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 150 }))); // no foodPortions
    global.fetch = fetchMock;

    // 1 container ~= 425g @ 150 kcal/100g = 637.5 kcal, not 150.
    const result = await service.calculateForIngredients([
      { name: 'container whole milk ricotta', quantity: '1' },
    ]);

    expect(result.calories).toBe(637.5);
  });

  it('derives calories from protein/fat/carb (Atwater factors) when a matched food has macros but no direct energy value', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(
        jsonResponse(
          foodDetail({ proteinGrams: 10, fatGrams: 5, carbGrams: 2 }),
        ),
      );
    global.fetch = fetchMock;

    // 10*4 + 2*4 + 5*9 = 93 kcal/100g.
    const result = await service.calculateForIngredients([
      { name: 'mystery dairy product', quantity: '100', unit: 'g' },
    ]);

    expect(result.calories).toBe(93);
  });

  it('caches a resolved food lookup so a repeated ingredient name skips the network entirely', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 200 })));
    global.fetch = fetchMock;

    const first = await service.calculateForIngredients([
      { name: 'chicken breast', quantity: '100', unit: 'g' },
    ]);
    const second = await service.calculateForIngredients([
      { name: 'Chicken Breast', quantity: '50', unit: 'g' }, // different case/quantity
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2); // only the first lookup hit the network
    expect(first.calories).toBe(200);
    expect(second.calories).toBe(100); // still scales correctly from the cached per-100g data
  });

  it('caches an unmatched (null) result too, not just successful matches', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ foods: [] })) // no match
      // If caching skipped null results, this second search would be hit.
      .mockResolvedValueOnce(jsonResponse(searchResult(1)))
      .mockResolvedValueOnce(jsonResponse(foodDetail({ calories: 150 })));
    global.fetch = fetchMock;

    const first = await service.calculateForIngredients([
      { name: 'obscure item' },
    ]);
    const second = await service.calculateForIngredients([
      { name: 'obscure item' },
    ]);

    expect(first.calories).toBe(0);
    expect(second.calories).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sums and rounds nutrient totals across multiple ingredients', async () => {
    // Ingredients are looked up concurrently, so requests can interleave —
    // route each mocked response off the request URL rather than call order.
    const nutrientsByFdcId: Record<
      number,
      Partial<Record<keyof NutritionTotals, number>>
    > = {
      1: { calories: 100.44, proteinGrams: 2.111 },
      2: { calories: 50.06, proteinGrams: 1.0 },
    };
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/foods/search')) {
        const query = new URL(url).searchParams.get('query');
        return Promise.resolve(
          jsonResponse(searchResult(query === 'flour' ? 1 : 2)),
        );
      }
      const fdcId = Number(url.match(/\/food\/(\d+)/)?.[1]);
      return Promise.resolve(jsonResponse(foodDetail(nutrientsByFdcId[fdcId])));
    }) as unknown as typeof fetch;

    // Both ingredients default to a 100g portion (no quantity/unit given).
    const result = await service.calculateForIngredients([
      { name: 'flour' },
      { name: 'sugar' },
    ]);

    expect(result).toEqual({
      ...ZERO,
      calories: 150.5,
      proteinGrams: 3.1,
    });
  });
});
