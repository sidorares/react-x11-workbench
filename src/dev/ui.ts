// The workshop's own look, in one place — so the sidebar, the toolbar and
// the controls panel cannot drift apart.
//
// The one palette fact this design is built around: in the light theme
// `background` and `surface` are **the same white** (core's palette says
// so explicitly), so a pane cannot be told apart from its neighbour by
// fill alone. Separation is therefore always a `$border` hairline, and the
// chrome/canvas distinction rides `$surfaceHover` — the palette's one
// tinted step, which is a warm grey in light (#f1f2f6) and a raised grey
// in dark (#2a3038). Chrome is tinted, the canvas is the ground.

/** Chrome: the rails around the work — sidebar, toolbar, controls. */
export const CHROME_BG = '$surfaceHover';

/** One hairline, the only thing that guarantees two panes read apart. */
export const HAIRLINE = { width: 1, color: '$border' } as const;

/**
 * Two sizes, and that is the scale: 11 for the labels that name things,
 * 13 for the things themselves. A third size is a decision to justify,
 * not a default to reach for.
 */
export const FONT = { meta: 11, body: 13 } as const;

/** The spacing step. Everything is one of these. */
export const SPACE = {
  hair: 4,
  tight: 8,
  row: 12,
  pane: 16,
  canvas: 24,
} as const;
