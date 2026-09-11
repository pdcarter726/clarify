import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as cheerio from 'cheerio';
import {
  ExtractedIngredient,
  ExtractedInstruction,
  ExtractedRecipe,
} from './extraction.types';

const UNITS = [
  'cups',
  'cup',
  'tablespoons',
  'tablespoon',
  'tbsp',
  'teaspoons',
  'teaspoon',
  'tsp',
  'ounces',
  'ounce',
  'oz',
  'pounds',
  'pound',
  'lbs',
  'lb',
  'grams',
  'gram',
  'g',
  'kilograms',
  'kilogram',
  'kg',
  'milliliters',
  'milliliter',
  'ml',
  'liters',
  'liter',
  'l',
  'pinches',
  'pinch',
  'dashes',
  'dash',
  'cloves',
  'clove',
  'cans',
  'can',
  'packages',
  'package',
  'slices',
  'slice',
  'sticks',
  'stick',
];

const QUANTITY_RE =
  /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*/;

// Unicode vulgar fractions (as commonly used on recipe sites, e.g. "1½ cups")
// aren't digits, so QUANTITY_RE can't see them. Normalize to ASCII "n/d" first.
const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function normalizeUnicodeFractions(text: string): string {
  // A fraction glyph is often glued to a whole number ("1½"), so a preceding
  // digit needs a space inserted or "1" + "1/2" would merge into "11/2".
  return text.replace(
    /(\d)?([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g,
    (_, digit: string | undefined, ch: string) =>
      digit ? `${digit} ${UNICODE_FRACTIONS[ch]}` : UNICODE_FRACTIONS[ch],
  );
}

/**
 * Scrapes a recipe page and extracts structured recipe data from its
 * schema.org JSON-LD (`@type: "Recipe"`), including best-effort parsing
 * of ingredient quantity/unit/name from free-text lines.
 */
@Injectable()
export class ExtractionService {
  /**
   * Fetches `url` and returns the normalized recipe found in its JSON-LD.
   * @throws NotFoundException if no Recipe node (or no title) is found on the page.
   * @throws BadRequestException if the URL can't be fetched or returns a non-OK status.
   */
  async extractFromUrl(url: string): Promise<ExtractedRecipe> {
    const html = await this.fetchHtml(url);
    const recipeNode = this.findRecipeNodeInHtml(html);
    if (!recipeNode) {
      throw new NotFoundException('No JSON-LD Recipe data found on the page');
    }
    return this.normalize(recipeNode, url);
  }

  private async fetchHtml(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch URL: ${(error as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new BadRequestException(
        `Failed to fetch URL: received status ${response.status}`,
      );
    }
    return response.text();
  }

  private findRecipeNodeInHtml(html: string): Record<string, any> | undefined {
    const $ = cheerio.load(html);
    let recipeNode: Record<string, any> | undefined;

    $('script[type="application/ld+json"]').each((_, el) => {
      if (recipeNode) return;
      const raw = $(el).text();
      try {
        recipeNode = this.findRecipeNode(JSON.parse(raw));
      } catch {
        // Ignore malformed JSON-LD blocks and keep looking.
      }
    });

    return recipeNode;
  }

  private findRecipeNode(data: unknown): Record<string, any> | undefined {
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findRecipeNode(item);
        if (found) return found;
      }
      return undefined;
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, any>;
      const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
      if (types.includes('Recipe')) {
        return obj;
      }
      if (Array.isArray(obj['@graph'])) {
        return this.findRecipeNode(obj['@graph']);
      }
    }
    return undefined;
  }

  private normalize(
    node: Record<string, any>,
    sourceUrl: string,
  ): ExtractedRecipe {
    if (typeof node.name !== 'string' || node.name.trim().length === 0) {
      throw new NotFoundException('Recipe data on the page has no title');
    }
    return {
      title: node.name.trim(),
      sourceUrl,
      imageUrl: this.extractImageUrl(node.image),
      servings: this.stringifyYield(node.recipeYield),
      prepTime: this.toReadableDuration(node.prepTime),
      cookTime: this.toReadableDuration(node.cookTime),
      ingredients: this.extractIngredients(node.recipeIngredient),
      instructions: this.extractInstructions(node.recipeInstructions),
    };
  }

  private extractImageUrl(image: unknown): string | undefined {
    if (!image) return undefined;
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return this.extractImageUrl(image[0]);
    if (
      typeof image === 'object' &&
      'url' in image &&
      typeof image.url === 'string'
    ) {
      return (image as { url: string }).url;
    }
    return undefined;
  }

  private stringifyYield(value: unknown): string | undefined {
    const toStr = (v: unknown): string | undefined =>
      typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
    if (value == null) return undefined;
    if (Array.isArray(value)) {
      // schema.org recipeYield arrays are typically redundant restatements of
      // the same yield (e.g. ["16", "16 servings"]), not a list of distinct
      // values — use the first one rather than concatenating duplicates.
      for (const v of value) {
        const str = toStr(v);
        if (str) return str;
      }
      return undefined;
    }
    return toStr(value);
  }

  private toReadableDuration(iso: unknown): string | undefined {
    if (typeof iso !== 'string' || iso.trim().length === 0) return undefined;
    const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso.trim());
    if (!match) return iso;
    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    if (!hours && !minutes) return iso;
    return [hours && `${hours} hr`, minutes && `${minutes} min`]
      .filter(Boolean)
      .join(' ');
  }

  private extractIngredients(raw: unknown): ExtractedIngredient[] {
    const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return lines
      .filter(
        (line): line is string =>
          typeof line === 'string' && line.trim().length > 0,
      )
      .map((line, index) => this.parseIngredientLine(line.trim(), index));
  }

  private parseIngredientLine(
    line: string,
    position: number,
  ): ExtractedIngredient {
    const normalizedLine = normalizeUnicodeFractions(line);
    const quantityMatch = QUANTITY_RE.exec(normalizedLine);
    if (!quantityMatch) {
      return { name: line, position };
    }

    const quantity = quantityMatch[1];
    const remainder = normalizedLine.slice(quantityMatch[0].length).trim();
    const unitMatch = UNITS.find(
      (unit) =>
        remainder.toLowerCase() === unit ||
        remainder.toLowerCase().startsWith(`${unit} `),
    );

    if (!unitMatch) {
      return { name: remainder || line, quantity, position };
    }

    const name = remainder.slice(unitMatch.length).trim();
    return { name: name || remainder, quantity, unit: unitMatch, position };
  }

  private extractInstructions(raw: unknown): ExtractedInstruction[] {
    const steps: string[] = [];
    const collect = (node: unknown): void => {
      if (!node) return;
      if (typeof node === 'string') {
        steps.push(node.trim());
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }
      if (typeof node === 'object') {
        const obj = node as Record<string, any>;
        if (Array.isArray(obj.itemListElement)) {
          collect(obj.itemListElement);
          return;
        }
        if (typeof obj.text === 'string') {
          steps.push(obj.text.trim());
          return;
        }
        if (typeof obj.name === 'string') {
          steps.push(obj.name.trim());
        }
      }
    };
    collect(raw);

    return steps
      .filter((text) => text.length > 0)
      .map((text, index) => ({ stepNumber: index + 1, text }));
  }
}
