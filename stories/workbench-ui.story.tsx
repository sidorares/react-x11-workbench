// The workbench, previewing its own parts. Dogfooding with a point: the
// error panel and the controls panel are surfaces you would otherwise only
// see by breaking something, and this is where their look gets reviewed.

import { ErrorPanel } from '../src/dev/error-panel.js';
import { ControlsPanel } from '../src/dev/controls.js';
import { story } from '../src/story/index.js';
import type { DiscoveredStory } from '../src/discovery/index.js';

export default { title: 'Workbench UI' };

const shallow = new Error('boom at import time');
shallow.stack = `Error: boom at import time
    at file:///repo/stories/broken.story.tsx:3:7
    at ModuleJob.run (node:internal/modules/esm/module_job:271:25)`;

export const importFailed = () => (
  <ErrorPanel heading="broken.story.tsx failed to import" error={shallow} />
);

export const storyCrashed = () => (
  <ErrorPanel
    heading="story crashed"
    error={new TypeError('rows is not iterable')}
  />
);

/** A stack long enough to prove the panel stays readable when it is. */
export const longStack = () => {
  const deep = new Error('Cannot read properties of undefined (reading map)');
  deep.stack = [
    'TypeError: Cannot read properties of undefined (reading map)',
    ...Array.from(
      { length: 12 },
      (_, i) =>
        `    at Frame${i} (file:///repo/src/dev/app.tsx:${100 + i * 7}:13)`,
    ),
  ].join('\n');
  return <ErrorPanel heading="story crashed" error={deep} />;
};

const sample: DiscoveredStory = {
  exportName: 'sample',
  name: 'sample',
  wrapped: true,
  render: () => null,
  meta: {
    args: {
      title: 'Space Helmet X24',
      outOfStock: false,
      padding: 12,
      accent: 'white',
    },
    controls: {
      outOfStock: 'boolean',
      padding: { type: 'number', min: 0, max: 40 },
      accent: ['white', 'grey', 'yellow'],
    },
  },
};

export const controls = story(
  (args: { edited: boolean }) => (
    <ControlsPanel
      story={sample}
      entries={[
        { key: 'outOfStock', spec: 'boolean' },
        { key: 'padding', spec: { type: 'number', min: 0, max: 40 } },
        { key: 'accent', spec: ['white', 'grey', 'yellow'] },
        { key: 'title', spec: 'text' },
      ]}
      overrides={args.edited ? { padding: 24 } : {}}
      onChange={() => {}}
      onReset={() => {}}
    />
  ),
  {
    name: 'Controls panel',
    args: { edited: false },
    size: { width: 280, height: 360 },
  },
);
