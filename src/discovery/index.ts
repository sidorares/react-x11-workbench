// Discovery: from a root directory to the story model every surface reads.
// The workshop's sidebar, `x11-workbench ls` and (later) `capture` all
// consume this one module, so the contract's reading lives in exactly one
// place. It is deliberately tolerant at the file level and strict inside
// one: a story module that throws on import becomes a diagnosed entry the
// workshop can show in its error panel, never a crash of the tool; an
// off-contract export inside a module that loaded becomes a diagnostic,
// never a silent omission.
//
// This module is Node-facing (fs, dynamic import) and is therefore not
// re-exported from the package root: the root barrel stays free of node
// builtins so the M4 browser publish target can consume the story types.
// Import it as `@react-x11/workbench/discovery`.
//
// Loading TypeScript is the runtime's problem, not this module's: under
// `tsx` (tests, `x11-workbench` itself, which registers tsx's loader) a
// `.story.tsx` import just works.

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { ReactNode } from 'react';
import { glob } from 'tinyglobby';
import {
  isStory,
  type FileMeta,
  type StoryDirection,
  type StoryMeta,
  type StorySize,
  type StoryTheme,
} from '../story/index.js';
import type { WorkbenchConfig } from '../index.js';

/** `WorkbenchConfig` with every default applied, plus where it came from. */
export interface ResolvedWorkbenchConfig {
  stories: readonly string[];
  decorators: NonNullable<WorkbenchConfig['decorators']>;
  themes: NonNullable<WorkbenchConfig['themes']>;
  sizes: Readonly<Record<string, StorySize>>;
  fonts: Readonly<Record<string, string>>;
  captureDir: string;
  /** Absolute path of the config file, or null when the defaults ran. */
  path: string | null;
}

export interface DiscoveredStory {
  /** The export's name in the module — the stable half of a story id. */
  exportName: string;
  /** Display name: `meta.name` when wrapped, the export name otherwise. */
  name: string;
  /** The wrapped meta, or `{}` for a plain component export. */
  meta: StoryMeta<object>;
  /** The export itself. Plain or wrapped, it is called the same way. */
  render: (args: object) => ReactNode;
  /** Whether the export went through `story()` (and so carries meta). */
  wrapped: boolean;
}

export interface Diagnostic {
  /** The file's id (root-relative posix path). */
  file: string;
  message: string;
}

export interface DiscoveredFile {
  /** Absolute path. */
  file: string;
  /** Root-relative posix path — the stable id discovery sorts by. */
  id: string;
  /** `meta.title`, or the basename with `.story.<ext>` stripped. */
  title: string;
  /** The default export, when it was a `FileMeta` object. */
  meta: FileMeta;
  /**
   * Stories in module-namespace order — which the spec sorts by export
   * name, not source order. Deterministic everywhere; authors who want a
   * curated order name their exports accordingly (a `FileMeta.order` is a
   * possible later rung, not smuggled in here).
   */
  stories: DiscoveredStory[];
  /** Why the module has no stories, when importing it threw. */
  error?: unknown;
  diagnostics: Diagnostic[];
}

export interface Discovery {
  root: string;
  config: ResolvedWorkbenchConfig;
  files: DiscoveredFile[];
  /** Every file's diagnostics, flattened, in file order. */
  diagnostics: Diagnostic[];
}

export interface DiscoverOptions {
  /** Defaults to `process.cwd()`. */
  root?: string;
  /**
   * Cache-buster appended to each story module's import URL. Node's module
   * cache is keyed by URL, so re-discovery with a fresh value re-evaluates
   * the modules — the watch-restart seam. Old evaluations are not unloaded
   * (that is ESM). Re-evaluating a module that registers an element is
   * safe since core's re-registration policy landed (react-x11#318): the
   * same definition registered twice no longer throws.
   */
  bust?: string;
  /** Skip config loading and use this one (a caller that already has it). */
  config?: ResolvedWorkbenchConfig;
}

const CONFIG_BASENAMES = [
  'workbench.config.ts',
  'workbench.config.mts',
  'workbench.config.js',
  'workbench.config.mjs',
];

/** The config file in `root`, if one exists. No upward search: the root is
 * the tool's argument, and a config above it acting at a distance is the
 * kind of spooky behaviour a small tool should not have. */
export async function findConfigFile(root: string): Promise<string | null> {
  for (const name of CONFIG_BASENAMES) {
    const candidate = path.join(root, name);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

export async function loadConfig(
  root: string,
): Promise<ResolvedWorkbenchConfig> {
  const file = await findConfigFile(root);
  let user: WorkbenchConfig = {};
  if (file) {
    const mod = (await import(pathToFileURL(file).href)) as {
      default?: unknown;
    };
    const def = mod.default;
    if (def === undefined) {
      throw new Error(
        `${file}: a workbench config default-exports a WorkbenchConfig object`,
      );
    }
    if (def === null || typeof def !== 'object') {
      throw new Error(
        `${file}: the default export is not a WorkbenchConfig object`,
      );
    }
    user = def as WorkbenchConfig;
  }
  return {
    stories: user.stories ?? ['**/*.story.tsx'],
    decorators: user.decorators ?? [],
    themes: user.themes ?? {},
    sizes: user.sizes ?? { default: { width: 640, height: 480 } },
    fonts: user.fonts ?? {},
    captureDir: user.captureDir ?? '__screenshots__',
    path: file,
  };
}

/** Absolute paths of every file matching the config's globs, sorted by
 * root-relative id. `node_modules` and `.git` are always excluded — that is
 * contract, not configuration. */
export async function findStoryFiles(
  root: string,
  patterns: readonly string[],
): Promise<string[]> {
  const matches = await glob([...patterns], {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });
  return matches
    .map((file) => path.resolve(file))
    .sort((a, b) => (idFor(root, a) < idFor(root, b) ? -1 : 1));
}

function idFor(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function deriveTitle(file: string): string {
  return path
    .basename(file)
    .replace(/\.[^.]+$/, '')
    .replace(/\.story$/, '');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadStoryFile(
  file: string,
  root: string,
  options: Pick<DiscoverOptions, 'bust'> = {},
): Promise<DiscoveredFile> {
  const id = idFor(root, file);
  const bust = options.bust ? `?bust=${encodeURIComponent(options.bust)}` : '';

  let namespace: Record<string, unknown>;
  try {
    namespace = (await import(pathToFileURL(file).href + bust)) as Record<
      string,
      unknown
    >;
  } catch (error) {
    return {
      file,
      id,
      title: deriveTitle(file),
      meta: {},
      stories: [],
      error,
      diagnostics: [
        { file: id, message: `failed to import: ${describe(error)}` },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  let meta: FileMeta = {};
  if ('default' in namespace) {
    const def = namespace['default'];
    if (def !== null && typeof def === 'object') {
      meta = def as FileMeta;
    } else {
      diagnostics.push({
        file: id,
        message:
          'default export ignored: a story file default-exports its FileMeta object; a component goes in a named export',
      });
    }
  }

  const stories: DiscoveredStory[] = [];
  for (const [exportName, value] of Object.entries(namespace)) {
    if (exportName === 'default') continue;
    if (typeof value !== 'function') {
      diagnostics.push({
        file: id,
        message: `named export '${exportName}' ignored: not a function, and every named export of a story file is a story`,
      });
      continue;
    }
    const wrapped = isStory(value);
    const storyMeta: StoryMeta<object> = wrapped ? value.meta : {};
    stories.push({
      exportName,
      name: storyMeta.name ?? exportName,
      meta: storyMeta,
      render: value as (args: object) => ReactNode,
      wrapped,
    });
  }

  return {
    file,
    id,
    title: meta.title ?? deriveTitle(file),
    meta,
    stories,
    diagnostics,
  };
}

export async function discover(
  options: DiscoverOptions = {},
): Promise<Discovery> {
  const root = path.resolve(options.root ?? process.cwd());
  const config = options.config ?? (await loadConfig(root));
  const files = await findStoryFiles(root, config.stories);

  // Sequential on purpose: story modules may register elements at import
  // time, and first-registration order should follow file order rather
  // than whichever import settled first.
  const loaded: DiscoveredFile[] = [];
  for (const file of files) {
    loaded.push(await loadStoryFile(file, root, options));
  }

  return {
    root,
    config,
    files: loaded,
    diagnostics: loaded.flatMap((file) => file.diagnostics),
  };
}

/** A story's effective presentation meta: its own, falling back to the
 * file's. Left unset when neither says — the consumer owns the default. */
export function effectiveMeta(
  file: DiscoveredFile,
  story: DiscoveredStory,
): { size?: StorySize; theme?: StoryTheme; direction?: StoryDirection } {
  return {
    size: story.meta.size ?? file.meta.size,
    theme: story.meta.theme ?? file.meta.theme,
    direction: story.meta.direction ?? file.meta.direction,
  };
}
