import { Injectable, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { cleanTitle, parseRecipeDescription } from './description-parser';
import { ExtractedInstruction, ExtractedRecipe } from './extraction.types';
import { parseIngredientLine } from './ingredient-parser';
import { PageFetcherService } from './page-fetcher.service';
import {
  PLATFORM_LABELS,
  VideoPlatform,
  canonicalVideoUrl,
  detectVideoPlatform,
  parseVideoPage,
  platformRequestHeaders,
} from './video-sources';

// Mirrors the recipe table's column sizes.
const TITLE_MAX = 255;
const SHORT_FIELD_MAX = 50;
const URL_MAX = 2048;

// How many links from a video description to try as full recipe pages.
const MAX_LINKED_PAGES = 3;
const NON_RECIPE_LINK_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'threads.net',
  'pinterest.com',
  'amazon.com',
  'amzn.to',
  'spotify.com',
  'patreon.com',
  'discord.gg',
  'twitch.tv',
  'linktr.ee',
];

/**
 * Scrapes recipes from URLs. Recipe websites are read from their schema.org
 * JSON-LD (`@type: "Recipe"`); YouTube, TikTok, and Instagram posts are read
 * from their descriptions, following a linked recipe page when the
 * description itself doesn't contain the recipe.
 */
@Injectable()
export class ExtractionService {
  constructor(private readonly pageFetcher: PageFetcherService) {}

  /**
   * Fetches `url` and returns the normalized recipe found there.
   * @throws NotFoundException if no recipe (or no title) is found on the page.
   * @throws BadRequestException if the URL can't be fetched.
   */
  async extractFromUrl(url: string): Promise<ExtractedRecipe> {
    const platform = detectVideoPlatform(url);
    return platform
      ? this.extractFromVideo(url, platform)
      : this.extractFromRecipePage(url, url);
  }

  private async extractFromRecipePage(
    pageUrl: string,
    sourceUrl: string,
  ): Promise<ExtractedRecipe> {
    const { html } = await this.pageFetcher.fetchPage(pageUrl);
    const recipeNode = this.findRecipeNodeInHtml(html);
    if (!recipeNode) {
      throw new NotFoundException('No JSON-LD Recipe data found on the page');
    }
    return this.normalize(recipeNode, sourceUrl);
  }

  private async extractFromVideo(
    url: string,
    platform: VideoPlatform,
  ): Promise<ExtractedRecipe> {
    const label = PLATFORM_LABELS[platform];
    const { html } = await this.pageFetcher.fetchPage(
      canonicalVideoUrl(platform, url),
      { headers: platformRequestHeaders(platform) },
    );
    const post = parseVideoPage(platform, html);
    if (!post) {
      throw new NotFoundException(
        `Couldn't read the description of that ${label} post (it may be private or removed)`,
      );
    }

    const parsed = parseRecipeDescription(post.description);
    const isCompleteRecipe =
      parsed.ingredients.length >= 2 && parsed.instructions.length >= 1;
    if (!isCompleteRecipe) {
      const linked = await this.extractFromLinkedPages(parsed.links, url);
      if (linked) {
        return {
          ...linked,
          imageUrl: linked.imageUrl ?? fitUrl(post.imageUrl),
        };
      }
    }
    if (parsed.ingredients.length === 0 && parsed.instructions.length === 0) {
      throw new NotFoundException(
        `No recipe found in the ${label} description: it has no ingredients or steps, and no linked recipe page`,
      );
    }

    // YouTube has real video titles; TikTok/Instagram captions usually open with one.
    const title =
      platform === 'youtube'
        ? (cleanTitle(post.title) ?? parsed.title)
        : (parsed.title ?? cleanTitle(post.title));
    return {
      title: truncate(title ?? `${label} recipe`, TITLE_MAX),
      sourceUrl: url,
      imageUrl: fitUrl(post.imageUrl),
      servings: truncateOptional(parsed.servings, SHORT_FIELD_MAX),
      prepTime: truncateOptional(parsed.prepTime, SHORT_FIELD_MAX),
      cookTime: truncateOptional(parsed.cookTime, SHORT_FIELD_MAX),
      ingredients: parsed.ingredients,
      instructions: parsed.instructions,
    };
  }

  /** Tries description links (most recipe-looking first) as JSON-LD recipe pages. */
  private async extractFromLinkedPages(
    links: string[],
    videoUrl: string,
  ): Promise<ExtractedRecipe | undefined> {
    const candidates = links
      .filter((link) => !isNonRecipeLink(link))
      .sort((a, b) => Number(/recipe/i.test(b)) - Number(/recipe/i.test(a)))
      .slice(0, MAX_LINKED_PAGES);
    for (const link of candidates) {
      try {
        return await this.extractFromRecipePage(link, videoUrl);
      } catch {
        // Not a recipe page (or unreachable); try the next link.
      }
    }
    return undefined;
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

  private extractIngredients(raw: unknown) {
    const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return lines
      .filter(
        (line): line is string =>
          typeof line === 'string' && line.trim().length > 0,
      )
      .map((line, index) => parseIngredientLine(line.trim(), index));
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

function isNonRecipeLink(link: string): boolean {
  try {
    const host = new URL(link).hostname.toLowerCase();
    return NON_RECIPE_LINK_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return true;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function truncateOptional(
  value: string | undefined,
  max: number,
): string | undefined {
  return value === undefined ? undefined : truncate(value, max);
}

function fitUrl(url: string | undefined): string | undefined {
  return url && url.length <= URL_MAX ? url : undefined;
}
