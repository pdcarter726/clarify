import type { CSSProperties } from "react";

// [cx, cy, r, fall distance] for the milk solids that sink to the bottom.
const DOTS: [number, number, number, number][] = [
  [82, 120, 3.2, 150],
  [100, 150, 2.6, 122],
  [118, 118, 3.6, 154],
  [138, 175, 2.8, 100],
  [156, 135, 3.2, 138],
  [172, 160, 2.4, 114],
  [92, 205, 3, 68],
  [146, 210, 2.6, 64],
  [112, 190, 2.4, 84],
];

// [cx, cy, rise distance, keyframe name]
const BUBBLES: [number, number, number, string][] = [
  [95, 282, -150, "bubA"],
  [130, 284, -175, "bubB"],
  [165, 282, -145, "bubA"],
  [112, 284, -120, "bubB"],
];

const FOAM: [number, number, number, number][] = [
  [80, 92, 22, 11],
  [104, 88, 20, 12],
  [128, 92, 22, 11],
  [152, 88, 21, 12],
  [177, 92, 22, 11],
  [116, 84, 10, 6],
  [160, 83, 9, 5],
];

/**
 * Looping illustration of butter being clarified: foam is skimmed off, milk
 * solids settle, and the melted butter turns from cloudy to clear gold. Pure
 * CSS animation (see `.bt-*` in globals.css); stills on the clear state under
 * `prefers-reduced-motion`.
 */
export default function ButterAnimation() {
  return (
    <svg
      viewBox="0 0 260 320"
      width="100%"
      style={{ maxWidth: 300, display: "block" }}
      role="img"
      aria-label="Animation: cloudy melted butter is skimmed and strained until clear golden butter remains"
    >
      <defs>
        <clipPath id="bt-clip">
          <path d="M62 40V268Q62 290 84 290H176Q198 290 198 268V40Z" />
        </clipPath>
        <linearGradient id="bt-depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--gold-deep)", stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: "var(--gold-deep)", stopOpacity: 0.38 }} />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="302" rx="92" ry="8" fill="var(--ink)" opacity=".08" />
      <g clipPath="url(#bt-clip)">
        <rect className="bt-liquid" x="58" y="92" width="144" height="202" />
        <rect x="58" y="92" width="144" height="202" fill="url(#bt-depth)" />
        <path
          className="bt-sed"
          d="M58 284Q85 274 110 281T160 279T202 281V300H58Z"
          fill="var(--solid)"
        />
        {DOTS.map(([cx, cy, r, dy]) => (
          <circle
            key={`${cx}-${cy}`}
            className="bt-dot"
            cx={cx}
            cy={cy}
            r={r}
            fill="var(--solid)"
            style={{ "--dy": `${dy}px` } as CSSProperties}
          />
        ))}
        {BUBBLES.map(([cx, cy, rise, name]) => (
          <circle
            key={`${cx}-${cy}`}
            className="bt-bub"
            cx={cx}
            cy={cy}
            r="2.6"
            fill="var(--foam)"
            style={{ "--rise": `${rise}px`, animationName: name } as CSSProperties}
          />
        ))}
        <g className="bt-foam">
          {FOAM.map(([cx, cy, rx, ry]) => (
            <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--foam)" />
          ))}
        </g>
        <rect className="bt-sweep" x="70" y="92" width="26" height="202" fill="#fff" />
        <rect x="72" y="54" width="9" height="206" rx="4.5" fill="#fff" opacity=".28" />
      </g>
      <path
        d="M62 40V268Q62 290 84 290H176Q198 290 198 268V40"
        fill="none"
        stroke="var(--edge)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M52 40H208" stroke="var(--edge)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
