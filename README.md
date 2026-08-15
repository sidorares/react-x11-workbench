# @react-x11/workbench

The component workshop for [react-x11](https://github.com/sidorares/react-x11):
develop, test and compare components in isolation — the problem Storybook
solves, solved natively for X11.

Status: **design**. The design is the PRD at
[docs/prd-workbench.md](docs/prd-workbench.md); the package currently ships
only the story contract (`@react-x11/workbench/story`), the zero-dependency
types that story files import.

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

Planned surfaces, per the PRD: `x11-workbench dev` (the workshop GUI — M1),
the live loop with Fast Refresh and knobs (M2), `x11-workbench capture`
(headless PNGs and visual diffing over the same story files — M3).
