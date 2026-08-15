// The root barrel: the story contract, plus the config shape
// `workbench.config.ts` default-exports. Story files should import from
// `@react-x11/workbench/story` — this barrel exists for the tool's own
// surfaces and for config files.

import type { ReactNode } from 'react';
import type { Story, StorySize } from './story/index.js';

export * from './story/index.js';

/** The shape of `workbench.config.ts`'s default export. All optional;
 * defaults are the PRD's (§Public API sketch). */
export interface WorkbenchConfig {
  /** Globs, relative to the config file; `node_modules` always excluded.
   * Default: `['**\/*.story.tsx']`. */
  stories?: readonly string[];
  /** Wrap every story: providers, padding, fonts. Applied outermost-first. */
  decorators?: readonly ((
    story: Story<object>,
    node: ReactNode,
  ) => ReactNode)[];
  /** Overrides fed to core's `resolveTheme` per scheme. */
  themes?: { light?: unknown; dark?: unknown };
  /** Named viewport presets for the toolbar and capture. */
  sizes?: Readonly<Record<string, StorySize>>;
  /** family → ttf path; default is the shipped font pack (M3). */
  fonts?: Readonly<Record<string, string>>;
  /** Baseline directory for `capture` (M3). Default `'__screenshots__'`. */
  captureDir?: string;
}

/** Identity helper so a config file gets checking without a type import. */
export function defineConfig(config: WorkbenchConfig): WorkbenchConfig {
  return config;
}
