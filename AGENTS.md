# AGENTS.md

Guidance for AI agents (and new contributors) working on
`@react-x11/workbench`.

## What this is

A component workshop for [react-x11](https://github.com/sidorares/react-x11):
develop, test and compare components in isolation. It solves the problem
Storybook solves, without being a port of Storybook — the five jobs
(develop in isolation, catalog states, QA the matrix, regression-test,
share) done natively, small.

Three surfaces over one contract:

- `@react-x11/workbench/story` — the story types. Zero dependencies, no
  node builtins: a repo can adopt the format without adopting the tool, and
  the browser publish target (M4) can bundle it.
- `@react-x11/workbench/discovery` — globs and module loading, producing
  the story model every other surface reads.
- `x11-workbench` — the bin. `ls` today, `dev` (the workshop) today,
  `capture` later.

The design is [docs/prd-workbench.md](docs/prd-workbench.md). Read it before
changing the shape of anything; it records why the tool is placed here
rather than in core or in `@react-x11/components`, and what each milestone
is for.

## Scope: components, not applications

**A story is something that renders inside another react-x11 component** —
the way a library component renders inside an app. That is the whole scope
(decided 2026-08-16).

A story whose root is a `<window>` — a whole application — is out of scope.
Mounting one inside the preview throws, the error boundary names it, and
that is the intended behaviour. Do not add nested-window or XEmbed preview
without a real demand; core's plug side
([react-x11#316](https://github.com/sidorares/react-x11/issues/316)) is not
a blocker for anything here.

## The story contract, and the rule that governs it

**Ceremony is additive.** An existing component export is the bottom rung —
including a module's _default_ export, so a component file nobody wrote for
this tool is already a story — and every rung up is a small diff to the
file already written, never a migration to a second dialect. The ladder is in the PRD; the three rules
that keep it honest:

1. **Opt-ins are orthogonal.** No field changes meaning because of another
   field's value.
2. **The file stays a program.** A story file is plain ESM that runs
   directly. The workbench reads the convention; it never owns it.
3. **Escalation is local.** Saying more about a story edits that export;
   about a file, the default export; about the repo,
   `workbench.config.ts`.

Applied to controls, that rule is why **`args` alone buys knobs**: a string
arg infers a text control, a number a number, a boolean a switch. Declaring
`controls` is for saying _more_ (bounds, options), never for permission.

## Layout

```
src/story/        the contract. No node builtins, no react-x11 import.
src/discovery/    globs + config + module loading -> the story model
src/dev/          the workshop: app.tsx (shell), controls.tsx,
                  error-panel.tsx, watch.ts, ui.ts (the look), index.tsx
src/cli/          the x11-workbench bin
stories/          this repo's own stories, including its own UI
test/             node --test, headless; fixtures/ are fake repos
scripts/          shot.tsx (screenshots), prepare-components.mjs
docs/             the PRD
```

`src/dev/app.tsx` is deliberately **pure UI over the story model**:
discovery and watching happen in `src/dev/index.tsx` and arrive as props.
That is what lets the entire workshop render headless in tests. Keep it
that way — if a component in `src/dev/` reaches for the filesystem, the
seam has been broken.

## Commands

```
npm test              node --test, headless, no display needed
npm run typecheck     tsc over src, test, stories, workbench.config.ts
npm run build         tsc -p tsconfig.build.json -> dist/
npm run format        prettier
npm run shot -- out.png [--select <story>] [--dark] [--both]
                      [--pin --then <story>] [--width N] [--height N]
node dist/cli/index.js dev [root]     the workshop (needs a real $DISPLAY)
node dist/cli/index.js ls [--json]    what discovery found
```

## Looking at the UI is part of the work

The workshop is a GUI. **Design questions are answered from screenshots,
not from reading the JSX** — `npm run shot` renders any view headlessly to
a PNG through the same in-process X server the tests use. Every visual
change should be looked at, and a claim about pixels should be measured:

- **Compare shots** rather than trusting an eye. A pixel diff of the whole
  window localizes a change to the row it happened in; that is how the core
  pin bump was verified as "no layout regression, one accent colour moved".
- **Measure geometry** when something looks wrong. Render the view, read
  `node.abs` on the nodes involved, print the rects. Every layout bug in
  this repo's history was found that way and would have been guessed wrong
  otherwise.
- Fonts are pinned to Bitstream Vera / DejaVu when present so two shots are
  comparable; without them ntk asks `fc-match`, which answers differently
  per machine.

## The look lives in one file

`src/dev/ui.ts` — chrome vs canvas, one hairline, a two-size type scale
(11 for labels, 13 for the things themselves), one spacing step. Use it;
do not introduce a third font size or an ad-hoc padding.

The palette fact this is built around: **in core's light theme
`background` and `surface` are the same white, by design.** A pane can
therefore never be told apart from its neighbour by fill alone. Separation
is always a `$border` hairline, and chrome rides `$surfaceHover` — the
palette's one tinted step, which reads correctly in both schemes.

## Testing

`node --test` via tsx, headless throughout. The workshop's own UI is tested
by rendering `WorkbenchApp` with a hand-built `Discovery` and driving it
with real injected clicks (`react-x11/test`'s `userEvent`), which is also
the harness the capture CLI will ride.

- **Hand-build the model** in UI tests. The shell's contract is "render
  whatever discovery says", so tests say it directly rather than going
  through the filesystem. Discovery has its own tests over `test/fixtures/`.
- **Text queries match substrings.** Copy elsewhere on screen will collide
  — the empty state's hint text contains the word "one" — so pass
  `{ exact: true }` when the string is short, and prefer roles.
- Stories in fixtures cover the off-contract cases on purpose: a module
  that throws at import, a default export that is neither `FileMeta` nor a
  component, a `memo()` default, a non-function named export. Those must
  stay diagnosed, never silent and never fatal. `test/fixtures/component-
repo/` is the opposite case — a repo of plain component modules with no
  story files at all, discovered by globbing `src/`.

## Dogfooding

`stories/badge.story.tsx` is the bottom rung dogfooded — a component
module with nothing but a default export. `stories/workbench-ui.story.tsx`
previews the workbench's own `ErrorPanel` and `ControlsPanel`. This is not a gimmick: they are surfaces
you would otherwise only see by breaking something, and reviewing them as a
grid is what caught the `size` semantics bug. When you add a piece of
workshop UI with states worth reviewing, give it a story.

## Pins

Both react-x11 packages are **git specs pinned to a full commit sha**, and
that is deliberate — npm 11 re-resolves a branch spec, so `#master` means a
different tree tomorrow. Dependabot is told to leave both alone.

- `react-x11` — core, unreleased. Its stated policy is that breaking
  changes are preferred over shims, so a bump is a deliberate step:
  typecheck, tests, build, and **screenshots compared before and after**.
- `@react-x11/components` — also unreleased, consumed for `<Tree>`. Two
  wrinkles, both worked around:
  1. Its peer range asks for `react-x11 ^2.0.0` while the git build reports
     1.2.0, so `overrides: { "react-x11": "$react-x11" }` in package.json
     forces one copy — our sha pin.
  2. A git install of it ships `src` without `dist`, because it builds on
     `prepack` and npm runs only `prepare` for git dependencies. So
     `scripts/prepare-components.mjs` compiles the slice we import, on
     postinstall. **Extend its `ENTRIES` when importing another component.**
     The real fix is a one-line `prepare` script upstream; delete this
     script when that lands.

## Conventions

- TypeScript, ESM, `verbatimModuleSyntax`; declarations are emitted, never
  written by hand.
- JSX is fine in `src/dev/` — the workshop is an app. `src/story/` stays
  free of node builtins and of react-x11 itself.
- Prettier, single quotes. `npm run format` before committing.
- Conventional commits; release-please reads them.
- **Comments explain why, not what.** The gotchas below are all comments in
  the code for exactly this reason.

## Gotchas

Each of these cost real time; none is obvious from the types.

- **A bare `<textinput>` has no chrome.** Core measures it at the font's cap
  band and leaves padding, border and line height to whoever mounts it —
  core's own `PasswordInput` wraps one in a field box. Mount one naked and
  the glyphs paint outside a ~12px box.
- **Sizing is border-box.** Putting `width`/`height` and `padding` on the
  same box hands the child `size` minus the padding. A fixed-size box also
  does not grow to its content, so an oversized child spills instead of
  pushing. `StoryFrame` keeps the sized box and the padded box separate for
  this reason.
- **Flex items do not shrink below their content by default.** Without
  `minWidth: 0` on a flexible column, a narrow window pushes controls off
  screen instead of shrinking the canvas.
- **Text colour cascades down the node tree, across a `ThemeProvider`.** A
  subtree previewed in the opposite scheme to its surroundings inherits the
  outer ink unless it declares `color: '$text'` — dark text on a dark card.
  Only explicitly-tokened colours flip on their own.
- **Numeric style props do not take `'$token'` strings.** Colours do;
  `borderRadius: '$radius'` does not typecheck. Use literals for geometry.
- **`overflow: 'scroll'` draws no track unless it overflows**, so it is free
  to add to a bounded box.
- **A `<window>`'s own width/height props win over the test harness's**, so
  a component that hardcodes them cannot be laid out at another size —
  which silently turns a "narrow window" test into a clipped screenshot of
  the same layout. `WorkbenchApp` takes `width`/`height` for this reason.
- **Module re-evaluation is by URL.** Discovery's `bust` option is what
  makes watch-restart re-read a story module; ESM never unloads the old
  evaluation. Re-registering an element is safe since core's
  re-registration policy landed
  ([react-x11#318](https://github.com/sidorares/react-x11/issues/318)).

## Releases

release-please, manifest mode, on `main`. Conventional commits drive the
version; the release PR updates `package.json`, `CHANGELOG.md` and
`.release-please-manifest.json` together.

Publishing is npm **trusted publishing** (OIDC) — no token secret. The
first publish cannot go through the workflow, because trusted publishing
binds to a package that already exists: push the first version by hand
once, then configure this repo and `.github/workflows/release-please.yml`
as a trusted publisher for `@react-x11/workbench` on npmjs.com.

That by-hand publish is plain `npm publish` — nothing to remember. `prepack`
runs the build, so the tarball has a `dist/` even from a clean checkout where
`dist/` is gitignored, and `publishConfig.access` marks the scope public
without the flag. Provenance is deliberately _not_ in `publishConfig`:
trusted publishing attaches it on its own, and asserting it in the manifest
would fail the by-hand publish, which has no OIDC to sign with.

## Pull requests

A PR that changes anything eye-detectable carries **screenshots rendered by
the PR's own code** — `npm run shot`, then upload with `gh-attach` (fill a
`<!-- drag in: shot.png -->` placeholder in the body). Do not commit
PR-illustration images.
