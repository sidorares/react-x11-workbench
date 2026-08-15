# PRD: `@react-x11/workbench` — the storybook problem, without Storybook

Status: proposed, design only. Nothing is implemented; this document records
the placement decision, the capability survey of react-x11 core and
`@react-x11/components`, and the staged design. Revised 2026-08-16: the
workshop GUI leads and headless capture follows, not the other way around.
The working name is **workbench** — "storybook" is the other project's name,
and this is deliberately not a port of it (§Open questions).

## What it is

An interactive component workshop for react-x11, aimed at **component
libraries**: small, medium and large components developed, tested and
**compared in isolation**, without booting an app around them. A small
story format feeds a native GUI app first, and a headless capture CLI later
— one contract, every consumer.

```tsx
// stories/table.story.tsx
import { story } from '@react-x11/workbench/story';
import { Table } from '@react-x11/components/table';

export default { title: 'Table' };

export const basic = () => (
  <Table rows={files} columns={columns} style={{ flexGrow: 1, minHeight: 0 }} />
);

export const multiSelect = story(
  (args) => (
    <Table rows={files} columns={columns} selectionMode="multiple" {...args} />
  ),
  { args: { rowHeight: 24 }, controls: { rowHeight: 'number' } },
);
```

```bash
x11-workbench dev              # the workshop window: sidebar, preview, compare, knobs
x11-workbench capture --diff   # later (M3): every story → PNG, headless, CI-safe
```

A story file is plain ESM: the default export is file metadata, each named
export is a story. No runtime dependency, no registration, no tool required
to import it — a test runner or a docs generator reads the same files the
workshop does.

## The problem, taken apart

Storybook is five jobs wearing one UI. Naming them separately matters,
because they translate to X11 with very different amounts of friction:

1. **Develop in isolation** — mount one component with fast feedback,
   without the app around it.
2. **Compare states side by side** — variants, sizes, themes of the same
   component next to each other; the review a library maintainer actually
   performs.
3. **Catalog** — a living inventory: every component, every variant,
   browsable by someone who did not write it.
4. **Automated regression** — screenshots diffed in CI; interaction
   scenarios that drive the component and assert what happened.
5. **Share and document** — a build a designer or a docs page can open.

Jobs 1–3 are the product and where this design starts: the workshop GUI.
Job 4 is a later dividend of the same story contract — and a cheap one
here, because core ships an in-process pure-JavaScript X server
(`react-x11/test`) that renders real pixels with no `$DISPLAY`, no Xvfb,
in CI. Job 5 is the far milestone.

Today's baseline in the ecosystem: demonstrating a component means reading
a doc page and running an example program on your own display; comparing
two variants means editing that program back and forth. CI never sees a
rendered component; the components website has zero images.

## Prior art, and what it settles

**Storybook (CSF 3)** — the story grammar is the part worth keeping: a
file's default export is metadata, each named export is a story, plain ESM
importable without the app. The part deliberately not taken: the
manager/preview two-app architecture, the addon platform, MDX docs — an
ecosystem, not a workshop, and its weight is why alternatives exist.

**Ladle** — proof that a small tool consuming a CSF subset covers the daily
80%: sidebar, preview, controls, no addons. The closest shape to this.

**react-cosmos** — fixtures as plain exported elements, decorators per
directory; validates "a component export is already a story".

**In-repo precedents** — the design mostly assembles things that exist:

- `examples/timeline.tsx` in `@react-x11/components`: a hand-built
  `Gallery({ title, of })` rendering the size × variant matrix — the
  comparison view, built once by hand, waiting to be a tool.
- Core's `scripts/screenshots.jsx`: headless PNG regeneration by driving
  real examples through the real event pipeline — the capture CLI in
  embryo, private to core (and react-x11#124 already asks to publish the
  renderToPNG half).
- Core's website `LiveDemo`: react-x11 + ntk + the JS X server + a browser
  compositor in one esbuild bundle, live code next to a live canvas — the
  existence proof for a browser publish target (§M4).

## Where it lives

Both existing repos state the same boundary rule; the workbench falls
outside both sides of it.

**Not in core.** Core carries what the vast majority of apps use, what
needs renderer internals, or what needs heavy standards compliance. A
workshop is none of these: shipped apps never run it, and every capability
it needs — rendering, input injection, queries, introspection — core
already exposes through `react-x11/test`, `react-x11/host` and
`react-x11/node`. It stands on public API the way components stand on host
elements.

**Not in `@react-x11/components`.** The tool breaks that repo's grammar at
every seam, and the grammar is load-bearing:

| repo rule                                          | the workbench                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| no JSX in `src/`                                   | is an app; its GUI is JSX throughout                                            |
| no component imports another component             | imports _every_ component, on purpose                                           |
| `sideEffects: false`, tree-shake guard per subpath | ships a CLI bin, a config loader, a file watcher — side effects are the product |
| every `src/` dir ⇒ subpath + docs page + example   | is not a component; the guards would fight it forever                           |
| `files: ["dist", "src"]` installed by every app    | would tax every runtime consumer with a dev tool                                |

And its consumers are wider than one repo: core's own examples, the
components library, and any app author's private component set.

**So: its own package and repo — this one** (`react-x11-workbench`).
One package, surfaces split by subpath:

- `@react-x11/workbench/story` — the story types and the `story()`
  wrapper. The only thing story files import. Zero dependencies, so a repo
  can adopt the format without adopting the tool.
- `@react-x11/workbench/capture` — the programmatic capture pipeline (M3),
  for repos that drive it from their own scripts.
- bin `x11-workbench` — `dev`, `ls`, `capture`.

Dependency shape: consuming repos add it as a **devDependency** only.
`react-x11` and `react` are peers; the workbench pins core by full commit
sha in its own devDependencies (npm 11 re-resolves branch specs), because
core's stated policy is pre-release breakage.

## The story contract

The ladder — `@react-x11/components`' continuity rule applied to the story
format: **ceremony is additive.** A file of plain component exports is the
bottom rung, and every rung up is a small diff to the file already written,
never a migration to a second dialect. The workshop, the capture CLI and
the docs pipeline read the same contract; there is no GUI-only or
capture-only story.

| When a story needs…                       | …it adds                                            | and nothing else moves                               |
| ----------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| to exist                                  | a `*.story.tsx` file; each named export a component | —                                                    |
| a variant to compare against              | another named export                                | the grid and compare views pick both up              |
| a title, a size, a fixed theme            | `export default { title, size, theme }`             | exports are found the same way                       |
| knobs                                     | `story(fn, { args, controls })`                     | plain exports beside it stay plain                   |
| shared chrome (providers, fonts, padding) | a decorator in `workbench.config.ts`                | story files don't know about it                      |
| interaction ("open the menu, then look")  | `play` on that story                                | the workshop runs it on demand; capture waits for it |
| a capture matrix (themes × sizes)         | `capture: { themes, sizes, delay }`                 | the workshop shows the same story once               |
| pixel-perfect CI                          | nothing — capture (M3) reads the same file          | —                                                    |

Three rules keep it honest:

1. **Opt-ins are orthogonal.** `play` does not change how `args` work;
   `capture` options never affect the workshop's rendering.
2. **The format outlives the tool.** Story files are plain ESM with a
   zero-dep types import; anything can read them, and deleting the
   workbench leaves meaningful modules behind.
3. **Escalation is local.** Saying more about a story edits that export;
   about a file, the default export; about the repo, `workbench.config.ts`.

### Public API sketch

```ts
// @react-x11/workbench/story — the whole import surface for story files
export interface StoryMeta<Args = {}> {
  name?: string; // sidebar label; default: export name
  size?: { width: number; height: number }; // preview + capture viewport
  theme?: 'light' | 'dark' | 'both';
  direction?: 'ltr' | 'rtl' | 'both';
  args?: Args; // initial knob values
  controls?: ControlsFor<Args>; // 'number' | 'text' | 'boolean' | options[]
  play?: (ctx: PlayContext) => Promise<void>;
  capture?: CaptureOptions; // M3: matrix, delay, mid-play shots
}
export function story<Args>(
  render: (args: Args) => ReactNode,
  meta?: StoryMeta<Args>,
): Story<Args>;

// PlayContext is react-x11/test re-surfaced: the bound queries,
// fireEvent/userEvent, act/settle/waitFor, plus shoot(name) for
// mid-interaction captures. Nothing new is invented here.
```

```ts
// workbench.config.ts (optional; defaults shown)
export default {
  stories: ['**/*.story.tsx'], // node_modules excluded
  decorators: [], // (story) => ReactNode — providers, padding
  themes: { light: undefined, dark: undefined }, // overrides resolveTheme inputs
  sizes: { default: { width: 640, height: 480 } },
  fonts: {}, // family → ttf path; defaults to the shipped pack
  captureDir: '__screenshots__',
};
```

Controls are **declared, not inferred**: no TypeScript docgen in the first
cut. Prop extraction from types is a later, separable feature (§Open
questions); explicit `args`/`controls` is Ladle's proven floor and keeps
the loader trivial.

## The workshop GUI — M1's heart

`x11-workbench dev` — itself a react-x11 app, and deliberately so: the
workbench is the best stress test the ecosystem has, and it eats core's
`SplitPane`, `Tree`, `Tabs` and the components package's `Table` and
`CodeEditor` (knob editing) in one window.

- **Sidebar**: core's `<Tree>` over files → stories, type-ahead included.
- **Preview**: the story mounted inside a `<box>`, with theme, direction
  and size wrappers applied by the toolbar. A story whose root is a
  `<window>` mounts as a **nested `<window>`** — core supports child
  windows inside windows (never inside boxes); its `width`/`height` props
  become the preview size. The nested-window edges (focus, decorations)
  get M1 spike time; the fallback is opening such stories as positioned
  toplevels beside the workshop (`transientFor`), which is how a
  multi-window app behaves anyway.
- **Compare view** — the reason this tool exists ahead of capture. Two
  modes, both consuming plain named exports:
  - _Split_: any two stories — or one story under two themes, two
    directions, two sizes, or two `args` sets — side by side in a
    `SplitPane`, scroll and knobs optionally linked.
  - _Grid_: every named export of a file in a labelled matrix (the
    `examples/timeline.tsx` `Gallery` formalized), with theme × size axes
    togglable. A library maintainer reviews a whole component's surface in
    one screen.
- **Toolbar**: light/dark, LTR/RTL, size presets; zoom-out overview later.
- **Error containment**: an error boundary per story plus `onUncaughtError`
  on the preview root; the failure panel shows the message, the owner
  chain and the source location (`ownerChainOf`, `sourceOf` — already
  exported by `react-x11/test`). Core has no error overlay; the
  workbench's panel is where one gets to exist.
- **Inspector**: `inspect(node)` from core drives a props/hooks panel
  in-process with no DevTools socket; `REACT_X11_DEVTOOLS=1` passthrough
  connects the real React DevTools for those who want it.
- **Story switching**: visited stories stay mounted under
  `<Activity mode="hidden">` for instant return (core implements
  hide/unhide and tests the toplevel map/unmap hazard, #201).
- **Watch mode**: restart-the-preview-tree by default — the watcher
  re-imports changed story modules (cache-busted) and remounts. Plain,
  loses component state, always correct. State-preserving Fast Refresh is
  M2 (react-x11#317), not the foundation, because its constraints are real
  and its failure mode is confusing staleness.

## The capture CLI — M3, riding the same contract

Deferred, not diminished: when it lands, it is one command over the story
files that already exist, leaning on `react-x11/test` end to end.

Per story: `renderX11(element, { app, width, height, fonts })` against a
shared in-process X server (one per run, stories sequential via the `app`
option), `act()` to flush the three clocks, run `play` if present, then
`toPNG`. Determinism is pinned with the harness's own switches: fonts via
`StaticFontSource` over a shipped font pack (DejaVu — never `fc-match`,
which is machine-dependent and absent in containers), appearance via
`setAppearanceForTests` (light and dark per story), screens via
`setScreensForTests`, time via `withFrameClock`.

Because server, client and RENDER rasterizer are all JavaScript, the same
story should produce the same bytes on every platform — the property that
makes committed baselines viable. The M3 spike verifies byte-stability;
the fallback is a perceptual, antialiasing-tolerant diff threshold, which
`--diff` wants anyway for font-pack upgrades.

```
x11-workbench capture                  # write every shot to __screenshots__/
x11-workbench capture --diff           # compare, write *.diff.png, exit 1 on change
x11-workbench capture --update -f table
x11-workbench capture --out /tmp/pr    # unbaselined shots, e.g. for gh-attach
```

What it unlocks for `@react-x11/components` when it arrives: CI visual
regression with no display, PR screenshots from one command instead of the
hand-rolled `AGENTS.md` recipe, and `docs/img/` pictures for a website
that currently has none.

## What core does not quite give it

The gap analysis, now with issues filed. Each is labeled **blocker** (a
milestone gates on it), **ergonomics** (workaround exists), or **gated**
(only a later milestone cares). Every workaround is on public API —
nothing here forks core.

1. **Fast Refresh is an example pattern, not a product**
   ([react-x11#317](https://github.com/sidorares/react-x11/issues/317)) —
   _blocker for M2 only._ Core's `examples/hmr-*.mjs` show state-preserving
   reload via Node ≥ 22.15 `module.registerHooks` + `react-refresh/babel`,
   with documented constraints (classic JSX transform, identity modules
   kept out of the hot graph). M1's watch-restart needs none of it; M2
   productizes it, ideally as core's `react-x11/refresh` so app authors
   get it too.
2. **`registerElement` throws on hot re-registration**
   ([react-x11#318](https://github.com/sidorares/react-x11/issues/318)) —
   _bites in M2._ Components register elements at module scope without
   `override`, so a hot-re-imported module throws. The proposal upstream is
   tolerating identical re-registration (or a refresh-session flag); the
   workbench's loader can interpose in the meantime.
3. **No plug-side embedding (`createRoot({ embedInto })`)**
   ([react-x11#316](https://github.com/sidorares/react-x11/issues/316)) —
   _gated on M4._ Out-of-process story isolation (crash containment,
   per-story element registries) wants a react-x11 root rendered into the
   workshop's window. Workable today from the other side — the story child
   opens a plain `<window>`, reports its id, the workshop embeds it with
   `<foreign windowId>` (plain reparenting, which `<foreign>` tolerates
   and reports) — but the handshake and focus story want the real plug.
4. **The mock backend has no text metrics**
   ([react-x11#319](https://github.com/sidorares/react-x11/issues/319)) —
   _ergonomics._ A fonts-capable `createMockApp({ fonts })` would allow a
   fast layout-only mode for large story matrices. The in-process X server
   is fast enough that this is an optimization, not a need.
5. **No error overlay** — _not a gap after all._ `onUncaughtError` /
   `setErrorHandler` are the right seams; the overlay is workbench UI, and
   arguably that is where it belongs.
6. **Pin drift is policy, not accident.** Core HEAD already moved yoga
   in-package and dropped `<markdown>/<html>/<tex>` (breaking, by stated
   pre-release policy). The workbench pins by sha and treats every bump as
   named work. Not a gap — a constraint the design plans around.
7. **`useWindowState` is ahead of the components pin** — _nice-to-have._
   Landed in core #313; useful for "is this story window actually visible"
   in the workshop. Arrives with the first natural pin bump.

## What `@react-x11/components` would adopt

All small, none blocking, and none required for the workbench to exist:

1. **A `stories/` directory, gradually.** `examples/` stays what it is —
   app-shaped, runnable demonstrations. Variant-matrix stories
   (`*.story.tsx`) grow beside them as components want comparison
   coverage; the config globs decide, per repo.
2. **A story guard, later.** `test/docs.test.ts`'s sibling: every
   component has at least one story. Only once `stories/` is real.
3. **CI capture and docs images, at M3.** Headless capture works in that
   repo's CI as-is (the same reason `npm test` needs no display); PR
   screenshots collapse to `capture --out` + `gh-attach`; captured PNGs
   under `docs/img/` give every component page a picture.

## Goals and non-goals

### Goals

1. **Interactive prototyping first** — mount, edit, and see one component
   in isolation; the edit-save-see loop is the product, and M1 ships it.
2. **Comparison as a first-class view** — variants, themes, directions and
   sizes side by side or in a grid; component libraries are the audience,
   and review-by-comparison is their daily job.
3. **A native workshop** that is itself a react-x11 app, dogfooding core
   widgets and the components package.
4. **One contract, all consumers** — the workshop, capture and docs read
   the same story files; no dialect drift possible.
5. **No runtime footprint** — devDependency only; story files import a
   zero-dep types package; shipped apps carry nothing.
6. **No new core features required for M1** — everything the workshop
   needs exists at the current pins. M2+ name their upstream asks
   explicitly (#316–#319), as deliberate pin bumps.

### Non-goals

- **Replicating Storybook.** No addon platform, no manager/preview split,
  no MDX docs system, no telemetry. The five jobs, natively, small.
- **Capture before the workshop.** Visual regression is M3 — a dividend of
  the contract, not the reason for it.
- **Docgen-from-types in the first cut.** Controls are declared. Type
  extraction is separable and additive later.
- **A browser-first experience.** The browser compositor publish target is
  M4-stretch, riding core's existing bundle work — not the foundation.
- **An a11y audit panel.** Core's a11y spy makes one possible; it is a
  later story option, not v1.
- **Cross-framework anything.** react-x11 only.
- **Owning `examples/`.** Existing example programs stay plain runnable
  programs; whether the workbench ever discovers them is a per-repo config
  decision, deferred (§Open questions).

## Testing and guards

The workbench tests itself the way its consumers will use it: headless,
`node --test`, no display, via `react-x11/test`. The GUI is a react-x11
app, so it is testable with `renderX11` + queries like any other. Contract
tests: a fixture directory of story files covering every rung, compiled
and discovered; discovery order is deterministic; the compare and grid
views render fixture matrices and are asserted with queries (and, from M3,
the tool's own capture baselines — the workbench screenshots the
workbench). Type tests pin `StoryMeta` and the `story()` overloads.

## Milestones

**M1 — the contract and the workshop.** `@react-x11/workbench/story`
types, discovery (`*.story.tsx` globs), `ls`, and `dev`: sidebar tree,
preview with theme/direction/size toolbar, **split and grid compare
views**, per-story error panel with owner chain and source location,
watch-restart, `Activity` story cache, the nested-window preview spike.
_Ship bar: a component-library author develops a new variant of `<Table>`
and reviews it against the existing variants side by side — edit, save,
see — without writing an example app or leaving the workshop._

**M2 — the live loop.** State-preserving Fast Refresh (react-x11#317, with
the #318 re-registration policy), the knobs panel (`args`/`controls` with
`CodeEditor` for object args), the inspector (`inspect()`-driven
props/hooks, DevTools passthrough), `play` functions runnable from the
workshop.

**M3 — capture.** `capture` with `--diff`/`--update`/`--filter`/`--out`,
the shipped font pack, light/dark matrix, capture-after-play, the
byte-determinism spike (perceptual threshold as designed fallback), CI
recipes for consuming repos. react-x11#319 (mock fonts) picked up here if
matrices outgrow the in-process server.

**M4 — isolation and publishing.** Out-of-process stories behind
`<foreign>` (clean version gated on react-x11#316), the browser publish
target riding core's compositor bundle (a static, shareable gallery),
docs-site image automation, a diff-review UI for `--diff` failures.

## Open questions (decision needed, defaults proposed)

1. **The name.** "Storybook" is another project's identity and this is not
   a clone. Proposed: `@react-x11/workbench`, bin `x11-workbench`, files
   `*.story.tsx` — "story" is the ecosystem's generic vocabulary; the
   tool's name is not.
2. **Story discovery beyond `*.story.tsx`.** `@react-x11/components`'
   seventeen `examples/*.tsx` follow an autorun-guard convention
   (`REACT_X11_NO_AUTORUN` + `export default App`) that would make them
   discoverable as zero-cost stories. Deliberately deferred: the focus is
   explicit story files for component libraries; revisit once the workshop
   is real and the appetite is known.
3. **Baseline policy (M3).** Committed PNGs (core's `docs/img` precedent)
   vs. CI-artifact-only diffing. Proposed: committed, revisit if the
   matrix explodes.
4. **Controls from types.** Explicit forever, or add TS-docgen extraction
   once the loader stabilizes? Proposed: revisit at M2 with real usage
   evidence; extraction must remain an additive rung, never required.
5. **Linked knobs in compare view.** When two panes show the same story
   with different `args`, does editing a knob edit one pane or both?
   Proposed: per-pane by default, a link toggle in the toolbar.

## Risks

- **Core moves under it.** Pre-release policy is explicit breakage; the
  yoga/document-elements change already shows the shape. Mitigation is the
  components repo's own: sha pins, named bumps, and M1 needing no new core
  features.
- **Nested-`<window>` preview has WM-shaped edges.** Child windows are
  real X windows; decorations, focus and size behaviour inside the preview
  need M1 spike time. Fallback: window-rooted stories open as positioned
  toplevels beside the workshop (`transientFor`).
- **Fast Refresh fragility (M2).** `module.registerHooks` requires Node ≥
  22.15; the classic-JSX and identity-module constraints are subtle; a
  stale-state bug erodes trust in the whole tool. Mitigation:
  watch-restart is the default and stays; Refresh is an opt-in rung whose
  constraints the loader enforces with errors, not mystery.
- **Byte-determinism turns out false (M3).** If rasterization differs
  across platforms, committed baselines get noisy. Mitigation: the M3
  spike tests this first; the perceptual-threshold diff is designed in,
  not bolted on.
