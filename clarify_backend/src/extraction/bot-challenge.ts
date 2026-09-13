// Markers of interstitial bot-check pages. Deliberately excludes Cloudflare's
// "challenge-platform" script, which is also injected into normal pages.
const CHALLENGE_MARKERS = [
  /<title>\s*Just a moment\.\.\.\s*<\/title>/i,
  /<title>\s*Attention Required! \| Cloudflare\s*<\/title>/i,
  /window\._cf_chl_opt/,
  /id="challenge-form"/,
  /captcha-delivery\.com/,
  /Enable JavaScript and cookies to continue/i,
];

/** True when `html` is a bot-check interstitial rather than the requested page. */
export function isBotChallenge(html: string): boolean {
  return CHALLENGE_MARKERS.some((marker) => marker.test(html));
}
