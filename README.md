# @react-x11/workbench

The component workshop for [react-x11](https://github.com/sidorares/react-x11):
develop, test and compare components in isolation — the problem Storybook
solves, solved natively for X11.

Status: **M1 in progress**. The design is the PRD at
[docs/prd-workbench.md](docs/prd-workbench.md); the package currently ships
the story contract (`@react-x11/workbench/story`, the zero-dependency types
that story files import), the discovery module
(`@react-x11/workbench/discovery`, globs → the story model),
`x11-workbench ls`, and the first cut of the workshop itself:
`x11-workbench dev` — sidebar over the discovered stories, preview pane,
light/dark toggle, per-story error containment, watch-restart on file
changes, and the compare views: selecting a file shows every story of it
as a labelled grid (optionally light beside dark), and Pin holds a story
in a split pane — with its own theme — while the sidebar changes the
other. A story with `args` gets a controls panel: text, number (slider
when bounded), switch and options editors, inferred from the args or
declared in `controls`, editing the running story live.

```tsx
// stories/table.story.tsx
import { story } from '@react-x11/workbench/story';
import { Table } from '@react-x11/components/table';

export default { title: 'Table' };

export const basic = () => <Table rows={files} columns={columns} />;

export const multiSelect = story(
  (args) => (
    <Table rows={files} columns={columns} selectionMode="multiple" {...args} />
  ),
  { args: { rowHeight: 24 }, controls: { rowHeight: 'number' } },
);
```

Still to come, per the PRD: the live loop with Fast Refresh, richer knobs and the inspector
(M2), and `x11-workbench capture` (headless PNGs and visual diffing over
the same story files — M3). The scope is component libraries: a story is
something that renders inside another react-x11 component, so a story
whose root is a `<window>` (a whole app) is named by the error panel
rather than embedded.

`@react-x11/components` is consumed from a git pin (it is not published
yet); `scripts/prepare-components.mjs` builds the slice the workbench
imports on postinstall, until upstream gains a `prepare` script.
