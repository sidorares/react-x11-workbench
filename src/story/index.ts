// The story contract — the whole import surface for story files, and the
// one part of the workbench a consuming repo takes a dependency on. It is
// deliberately zero-dependency at runtime (react and react-x11 appear as
// type-only imports, erased by `verbatimModuleSyntax`): a story file is
// plain ESM that a test runner or a docs generator can import without the
// tool, and deleting the workbench leaves meaningful modules behind.
//
// The contract, from docs/prd-workbench.md §The story contract:
// - a `*.story.tsx` file's default export is `FileMeta`;
// - each named export is a story — a plain component, or `story()` when it
//   needs args, controls, a play function or capture options;
// - ceremony is additive: every rung is a small diff to the file already
//   written, never a second dialect.

import type { ReactNode } from 'react';

/** Preview and capture viewport, in pixels. */
export interface StorySize {
  width: number;
  height: number;
}

/** 'both' renders the story twice where a matrix makes sense (capture, grid). */
export type StoryTheme = 'light' | 'dark' | 'both';
export type StoryDirection = 'ltr' | 'rtl' | 'both';

/**
 * A knob's editor. Declared, not inferred — an options array renders a
 * select, the rest name their input. Type extraction from props is a
 * possible later rung (PRD §Open questions), never a requirement.
 */
export type ControlSpec =
  'number' | 'text' | 'boolean' | readonly (string | number)[];

export type ControlsFor<Args> = {
  readonly [K in keyof Args]?: ControlSpec;
};

/** Capture options (M3). Present in the contract so a story written today
 * needs no edits when the CLI lands; the workshop ignores them. */
export interface CaptureOptions {
  /** Themes to shoot; default is the file/story `theme`, expanded from 'both'. */
  themes?: readonly ('light' | 'dark')[];
  /** Named viewports to shoot beyond the story's own `size`. */
  sizes?: Readonly<Record<string, StorySize>>;
  /** Fake-clock milliseconds advanced before the shot (animations settle). */
  delay?: number;
}

/**
 * What a `play` function receives: react-x11/test re-surfaced — the bound
 * queries, the real event injection, and the clocks — plus `shoot()` for
 * mid-interaction captures. Nothing here is invented by the workbench.
 */
export interface PlayContext {
  screen: (typeof import('react-x11/test'))['screen'];
  within: (typeof import('react-x11/test'))['within'];
  fireEvent: (typeof import('react-x11/test'))['fireEvent'];
  userEvent: (typeof import('react-x11/test'))['userEvent'];
  act: (typeof import('react-x11/test'))['act'];
  waitFor: (typeof import('react-x11/test'))['waitFor'];
  /** Capture a named shot at this point in the interaction. A no-op outside
   * `x11-workbench capture`, so `play` runs identically in the workshop. */
  shoot(name: string): Promise<void>;
}

/** Per-story metadata, the second argument to {@link story}. */
export interface StoryMeta<Args extends object = {}> {
  /** Sidebar label; default: the export's own name. */
  name?: string;
  size?: StorySize;
  theme?: StoryTheme;
  direction?: StoryDirection;
  /** Initial knob values. */
  args?: Args;
  controls?: ControlsFor<Args>;
  play?: (ctx: PlayContext) => Promise<void>;
  capture?: CaptureOptions;
}

/** A story file's default export: file-level defaults every story inherits. */
export interface FileMeta {
  /** Sidebar group; default: the file's path-derived name. */
  title?: string;
  size?: StorySize;
  theme?: StoryTheme;
  direction?: StoryDirection;
}

// `Symbol.for`, not `Symbol`: two copies of this module (a version skew, a
// linked workspace) must still recognize each other's stories.
const STORY = Symbol.for('react-x11-workbench.story');

/** A named export the discovery treats as a story with attached metadata.
 * Plain component exports are stories too — this is the wrapped rung. */
export interface Story<Args extends object = {}> {
  (args: Args): ReactNode;
  readonly meta: StoryMeta<Args>;
}

export function story<Args extends object = {}>(
  render: (args: Args) => ReactNode,
  meta: StoryMeta<Args> = {},
): Story<Args> {
  return Object.assign((args: Args) => render(args), {
    meta,
    [STORY]: true,
  });
}

/** Whether a module export was wrapped by {@link story} (and so carries
 * `meta`), as opposed to being a plain component export. */
export function isStory(value: unknown): value is Story<object> {
  return (
    typeof value === 'function' &&
    (value as unknown as Record<PropertyKey, unknown>)[STORY] === true
  );
}
