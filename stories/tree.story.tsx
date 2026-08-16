// @react-x11/components' <Tree> — the same component the workbench's own
// sidebar uses, here as a story of its own.

import { Tree } from '@react-x11/components/tree';

export default { title: 'Tree' };

export const files = () => (
  <Tree
    items={[
      {
        id: 'src',
        label: 'src',
        children: [
          { id: 'src/index.ts', label: 'index.ts' },
          { id: 'src/story', label: 'story', children: [] },
        ],
      },
      { id: 'package.json', label: 'package.json' },
      { id: 'README.md', label: 'README.md' },
    ]}
    defaultExpanded={['src']}
    style={{ width: 260, height: 220 }}
  />
);
