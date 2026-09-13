import { ExtractedIngredient, ExtractedInstruction } from './extraction.types';
import { parseIngredientLine, startsWithQuantity } from './ingredient-parser';

/** Recipe fields recovered from free-form text such as a video description. */
export interface ParsedDescription {
  title?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: ExtractedIngredient[];
  instructions: ExtractedInstruction[];
  /** Every http(s) link in the text, in order of appearance. */
  links: string[];
}

type Section = 'none' | 'ingredients' | 'instructions' | 'other';

const URL_RE = /https?:\/\/[^\s<>"'()[\]{}]+/gi;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const EMOJI_RE = /\p{Extended_Pictographic}|️|‍|⃣/gu;
const LEADING_BULLET_RE = /^[\s•·▪▫◦●○■□►▶➤➔→*~|>\-–—]+/;

// "1️⃣ Mix", "1. Mix", "1) Mix", "Step 1: Mix" (but not "1.5 cups" or "1 egg").
const KEYCAP_STEP_RE = /^\s*(?:\d️?⃣|🔟)\s*/u;
const NUMBERED_STEP_RE = /^(?:step\s*)?\d{1,2}\s*[.):](?!\d)\s*/i;
const STEP_WORD_RE = /^step\s*\d{1,2}\b\s*[.):\-–]?\s*/i;

const HEADER_END = String.raw`\s*(?:\([^)]*\))?\s*(?:[:\-–—]\s*(.*)|$)`;
const INGREDIENTS_HEADER_RE = new RegExp(
  String.raw`^(?:the\s+|main\s+)?(?:ingredients?(?:\s+list)?|what\s+you(?:'|’)?(?:ll|\s+will)?\s+need|you(?:'|’)?(?:ll|\s+will)\s+need|shopping\s+list)` +
    HEADER_END,
  'i',
);
const INSTRUCTIONS_HEADER_RE = new RegExp(
  String.raw`^(?:instructions?|directions?|method|steps?|how\s+to\s+make(?:\s+it)?|preparation)` +
    HEADER_END,
  'i',
);
const OTHER_HEADER_RE = new RegExp(
  String.raw`^(?:notes?|tips?|equipment|tools|nutrition(?:\s+facts)?|music|song|chapters|timestamps|links?|socials?|shop|merch|affiliate\s+links?|disclaimer|credits?)` +
    HEADER_END,
  'i',
);
// Sub-headers inside the ingredient list, e.g. "For the sauce:".
const SUBHEADER_RE = /^(?:for\s+(?:the\s+)?)?[\p{L}\s&'’]{1,30}:$/u;

const OUTRO_RE =
  /\b(?:subscribe|follow\s+(?:me|us|for)|link\s+in\s+(?:my\s+)?bio|full\s+recipe|recipe\s+(?:is\s+)?(?:on|at)\s+(?:my|the)|check\s+out|thanks\s+for\s+watching|save\s+(?:this|for\s+later)|share\s+this|tag\s+a\s+friend|newsletter|business\s+inquir|comment\s+below|turn\s+on\s+notifications)\b/i;
const NOT_INGREDIENT_RE =
  /\b(?:minutes?|mins?|hours?|hrs?|servings?|people|calories|kcal|likes|views|followers|days?\s+ago)\b/i;

const TIME = String.raw`(\d+\s*(?:hours?|hrs?|h)\b(?:\s*(?:and\s*)?\d+\s*(?:minutes?|mins?|m)\b)?|\d+\s*(?:minutes?|mins?|m)\b)`;
const PREP_RE = new RegExp(
  String.raw`\bprep(?:aration)?(?:\s*time)?\s*[:\-–]?\s*` + TIME,
  'i',
);
const COOK_RE = new RegExp(
  String.raw`\b(?:cook(?:ing)?|bak(?:e|ing))(?:\s*time)?\s*[:\-–]?\s*` + TIME,
  'i',
);
const SERVINGS_RE =
  /\b(?:serves|servings?|yields?|makes)\s*[:\-–]?\s*(\d+(?:\s*(?:-|to)\s*\d+)?(?:\s+(?!and\b|in\b)[a-z]+)?)/i;

/**
 * Heuristically reads a recipe out of unstructured text like a YouTube,
 * TikTok, or Instagram description. Understands explicit "Ingredients:" /
 * "Instructions:" sections, and falls back to classifying lines: ones that
 * start with a quantity are ingredients, numbered lines are steps.
 */
export function parseRecipeDescription(text: string): ParsedDescription {
  const links = [
    ...new Set(
      [...text.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:!?]+$/, '')),
    ),
  ];

  const ingredientLines: string[] = [];
  const steps: string[] = [];
  let section: Section = 'none';
  let title: string | undefined;
  let servings: string | undefined;
  let prepTime: string | undefined;
  let cookTime: string | undefined;
  let lastKind: 'ingredient' | 'step' | 'other' | undefined;
  let previousLineBlank = true;
  let sawContent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const hasStepMarker =
      KEYCAP_STEP_RE.test(rawLine) ||
      NUMBERED_STEP_RE.test(stripDecorations(rawLine)) ||
      STEP_WORD_RE.test(stripDecorations(rawLine));
    const line = cleanLine(rawLine);
    if (!line) {
      previousLineBlank = true;
      continue;
    }
    const isFirstContentLine = !sawContent;
    sawContent = true;

    const ingredientsHeader = INGREDIENTS_HEADER_RE.exec(line);
    const instructionsHeader = INSTRUCTIONS_HEADER_RE.exec(line);
    const otherHeader = OTHER_HEADER_RE.exec(line);
    let content = line;
    if (ingredientsHeader) {
      section = 'ingredients';
      content = ingredientsHeader[1]?.trim() ?? '';
    } else if (instructionsHeader) {
      section = 'instructions';
      content = instructionsHeader[1]?.trim() ?? '';
    } else if (otherHeader) {
      section = 'other';
      content = '';
    }

    // Metadata lines ("Serves 4 | Prep 10 min") are captured, not classified.
    const isMetadata =
      section !== 'instructions' &&
      content.length <= 80 &&
      (PREP_RE.test(content) ||
        COOK_RE.test(content) ||
        SERVINGS_RE.test(content));
    servings ??= SERVINGS_RE.exec(line)?.[1]?.trim();
    prepTime ??= PREP_RE.exec(line)?.[1]?.trim();
    cookTime ??= COOK_RE.exec(line)?.[1]?.trim();

    if (!content || section === 'other' || isMetadata) {
      previousLineBlank = false;
      continue;
    }

    const kind = classify(
      content,
      section,
      hasStepMarker,
      lastKind,
      ingredientLines.length,
    );
    if (kind === 'ingredient') {
      ingredientLines.push(stripStepMarker(content));
    } else if (kind === 'step') {
      const stepText = stripStepMarker(content);
      const continuesPrevious =
        !hasStepMarker &&
        !previousLineBlank &&
        lastKind === 'step' &&
        steps.length > 0 &&
        !/[.!?)]$/.test(steps[steps.length - 1]);
      if (continuesPrevious) {
        steps[steps.length - 1] += ` ${stepText}`;
      } else {
        steps.push(stepText);
      }
      if (section === 'none' && hasStepMarker) section = 'instructions';
    } else if (
      isFirstContentLine &&
      !ingredientsHeader &&
      !instructionsHeader
    ) {
      title = toTitle(content);
    }
    lastKind = kind;
    previousLineBlank = false;
  }

  return {
    title,
    servings,
    prepTime,
    cookTime,
    ingredients: ingredientLines.map((line, index) =>
      parseIngredientLine(line, index),
    ),
    instructions: steps.map((text, index) => ({
      stepNumber: index + 1,
      text,
    })),
    links,
  };
}

function classify(
  line: string,
  section: Section,
  hasStepMarker: boolean,
  lastKind: 'ingredient' | 'step' | 'other' | undefined,
  ingredientCount: number,
): 'ingredient' | 'step' | 'other' {
  if (OUTRO_RE.test(line)) return 'other';

  if (section === 'ingredients') {
    if (SUBHEADER_RE.test(line)) return 'other';
    const remainder = stripStepMarker(line);
    // Some creators number their ingredients; a long numbered sentence is a step.
    if (
      hasStepMarker &&
      !startsWithQuantity(remainder) &&
      remainder.length > 40
    ) {
      return 'step';
    }
    return line.length <= 120 ? 'ingredient' : 'other';
  }

  if (section === 'instructions') return 'step';

  // No section header seen: infer from the shape of the line.
  if (hasStepMarker) return 'step';
  if (
    startsWithQuantity(line) &&
    line.length <= 80 &&
    !/[.!?]$/.test(line) &&
    !NOT_INGREDIENT_RE.test(line)
  ) {
    return 'ingredient';
  }
  // Unquantified items like "Salt, to taste" in the middle of an ingredient list.
  if (lastKind === 'ingredient' && line.length <= 60 && !/[.!?]$/.test(line)) {
    return 'ingredient';
  }
  if (ingredientCount > 0 && line.length >= 30) return 'step';
  return 'other';
}

/** Removes URLs, hashtags, emoji, and leading bullets; returns '' for decoration-only lines. */
function cleanLine(line: string): string {
  // Order matters: URLs can contain "#", keycap step numbers ("1️⃣") must go
  // before their emoji codepoints are stripped (leaving a bare digit), and
  // emoji must become spaces before hashtags glued to them ("🥞#food") match.
  return stripDecorations(
    line
      .replace(URL_RE, ' ')
      .replace(KEYCAP_STEP_RE, '')
      .replace(EMOJI_RE, ' ')
      .replace(HASHTAG_RE, '$1'),
  )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripDecorations(line: string): string {
  return line
    .replace(KEYCAP_STEP_RE, '')
    .replace(EMOJI_RE, ' ')
    .replace(LEADING_BULLET_RE, '')
    .trim();
}

function stripStepMarker(line: string): string {
  return line.replace(STEP_WORD_RE, '').replace(NUMBERED_STEP_RE, '').trim();
}

function toTitle(line: string): string | undefined {
  const title = line.replace(/[:\-–—|]+$/, '').trim();
  return title.length >= 3 && title.length <= 120 ? title : undefined;
}

/** Cleans a platform-supplied title (e.g. "PANCAKES🥞 #recipe #food") for display. */
export function cleanTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  return toTitle(cleanLine(title));
}
