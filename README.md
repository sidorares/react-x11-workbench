# @react-x11/workbench

A component workshop for [react-x11](https://github.com/sidorares/react-x11):
develop, test and compare components in isolation.

It solves the problem Storybook solves, for a toolkit that has no browser to
put an iframe in. It is not a port of Storybook — no addon platform, no
manager/preview split, no MDX. Just the jobs: mount one component on its
own, see every variant at once, tweak its props while it runs, and compare
two of them side by side.

> **Status: M1.** The story contract, discovery, `x11-workbench ls` and the
> workshop GUI are implemented and tested. Hot reload with state preserved,
> a richer knobs panel and the component inspector are M2; headless
> screenshot capture and visual diffing are M3. The design, including what
> is deliberately not here, is in [docs/prd-workbench.md](docs/prd-workbench.md).

## A story

A story is **a component rendered inside another react-x11 component** —
the way your library's component renders inside somebody's app. A file's
named exports are its stories; its default export is the file's metadata.

```tsx
// stories/card.story.tsx
import { story } from '@react-x11/workbench/story';
import { Card } from '../src/card.js';

export default { title: 'Card' };

// The simplest thing that works: a component export.
export const basic = () => <Card title="Space Helmet X24" />;

// Say more when you need more — never on a second API.
export const product = story(
  (args: { title: string; outOfStock: boolean; padding: number }) => (
    <Card {...args} />
  ),
  {
    args: { title: 'Space Helmet X24', outOfStock: false, padding: 12 },
    controls: { padding: { type: 'number', min: 0, max: 40 } },
  },
);
```

Ceremony is additive: every capability is an independent opt-in on the story
you already wrote, and the file stays a plain module you can run yourself.

## Install

```bash
npm i -D @react-x11/workbench
```

`react-x11` and `react` are peer dependencies. Optionally add a config —
without one, every `**/*.story.tsx` is discovered:

```ts
// workbench.config.ts
export default {
  stories: ['stories/**/*.story.tsx'],
};
```

## Use

```bash
x11-workbench dev      # the workshop (needs a running X server)
x11-workbench ls       # what was discovered; --json for the model
```

### The workshop

- **Select a story** — it mounts on a canvas, in a frame the size of the
  component itself.
- **Select a file** — every story in it at once, as a labelled grid.
  **Both themes** doubles the grid, light beside dark.
- **Pin** — holds the current story in one pane while the sidebar drives
  the other. The pinned pane owns its own theme, so pinning a story and
  flipping it is how you compare one component against itself.
- **Controls** — a story with `args` gets a panel: text, number (a slider
  when bounded), switch, options. Edits apply to the running story without
  remounting it, so its state survives your tweaking, and they persist
  while you look at something else. **Reset** drops them.
- Editing a story file re-discovers and remounts it.

A story that throws is contained: the failure gets a panel with its stack,
and the rest of the workshop keeps working. So does a story file that
throws while being imported.

## Story reference

```ts
export default {
  title?: string,        // sidebar label; default: the file's basename
  size?, theme?, direction?,   // defaults for every story in the file
}

story(render, {
  name?: string,         // display name; default: the export name
  size?: { width, height },    // the room the story gets
  theme?: 'light' | 'dark' | 'both',
  direction?: 'ltr' | 'rtl' | 'both',
  args?: object,         // initial props — this alone gives you controls
  controls?: {           // say more than the arg's type does
    [key]: 'text' | 'number' | 'boolean'
         | readonly (string | number)[]              // options
         | { type: 'number', min?, max?, step? },    // slider when bounded
  },
  play?, capture?,       // reserved for M2/M3; ignored today
})
```

Controls are inferred from `args` when you do not declare them: a string is
a text field, a number a number, a boolean a switch.

## Subpaths

| Import                           | What it is                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `@react-x11/workbench/story`     | The contract. Zero dependencies — adopt the format without the tool. |
| `@react-x11/workbench/discovery` | Globs and module loading to the story model. Node-facing.            |
| `x11-workbench`                  | The bin: `dev`, `ls`.                                                |

## Development

```bash
npm test              # headless: no display, no xvfb
npm run typecheck
npm run shot -- out.png --select product    # screenshot any view
```

The whole suite — the workshop's own UI included — renders against
node-x11's pure-JavaScript X server in process, via `react-x11/test`. The
same path takes screenshots, which is how this repo does design review; see
[AGENTS.md](AGENTS.md).

The workbench previews its own error and controls panels
(`stories/workbench-ui.story.tsx`), which is both a demo and how those
surfaces get reviewed.

## Licence

MIT
