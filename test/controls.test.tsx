// The controls panel, driven headless: inference from args, live edits
// without remounting (story state survives a tweak), reset, and
// persistence across story switches.

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { useState } from 'react';
import { renderX11, userEvent, waitFor, within, cleanup } from 'react-x11/test';
import { WorkbenchApp } from '../src/dev/app.js';
import { controlEntries } from '../src/dev/controls.js';
import type {
  DiscoveredFile,
  DiscoveredStory,
  Discovery,
  ResolvedWorkbenchConfig,
} from '../src/discovery/index.js';

const config: ResolvedWorkbenchConfig = {
  stories: ['**/*.story.tsx'],
  decorators: [],
  themes: {},
  sizes: { default: { width: 640, height: 480 } },
  fonts: {},
  captureDir: '__screenshots__',
  path: null,
};

function makeStory(partial: Partial<DiscoveredStory>): DiscoveredStory {
  return {
    exportName: 'story',
    name: 'story',
    meta: {},
    render: () => null,
    wrapped: true,
    ...partial,
  };
}

function makeModel(stories: DiscoveredStory[]): Discovery {
  const file: DiscoveredFile = {
    file: '/fake/knobs.story.tsx',
    id: 'knobs.story.tsx',
    title: 'Knobs',
    meta: {},
    stories,
    diagnostics: [],
  };
  return { root: '/fake', config, files: [file], diagnostics: [] };
}

const knobbed = makeStory({
  exportName: 'knobbed',
  name: 'knobbed',
  meta: {
    args: { label: 'Told', on: false, pad: 4, kind: 's' },
    controls: { on: 'boolean', kind: ['s', 'l'] },
  },
  render: (args: {
    label?: string;
    on?: boolean;
    pad?: number;
    kind?: string;
  }) => (
    <text>{`label=${args.label} on=${String(args.on)} pad=${args.pad} kind=${args.kind}`}</text>
  ),
});

after(() => cleanup());

test('controlEntries: declared plus inferred, uninferrable skipped', () => {
  const entries = controlEntries(
    makeStory({
      meta: {
        args: { a: 'x', n: 1, b: true, obj: { deep: 1 } },
        controls: { n: { type: 'number', min: 0, max: 10 } },
      },
    }),
  );
  assert.deepEqual(
    entries.map((e) => [e.key, e.spec]),
    [
      ['n', { type: 'number', min: 0, max: 10 }],
      ['a', 'text'],
      ['b', 'boolean'],
    ],
  );
});

test('controls: text edits apply live; Reset restores the args', async () => {
  const r = await renderX11(<WorkbenchApp initial={makeModel([knobbed])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('knobbed'));
  await r.findByText(/label=Told on=false/);

  // The inferred text control carries its key as placeholder.
  const input = r.getByPlaceholder('label');
  await userEvent.type(input, '!');
  await r.findByText(/label=Told! /);

  await userEvent.click(r.getByRole('button', { name: 'Reset' }));
  await r.findByText(/label=Told on=false/);
  await r.unmount();
});

test('controls: switch and options drive the story', async () => {
  const r = await renderX11(<WorkbenchApp initial={makeModel([knobbed])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('knobbed'));
  await r.findByText(/on=false/);

  const onRow = r.getByTestName('control-on');
  await userEvent.click(within(onRow).getByRole('switch'));
  await r.findByText(/on=true/);

  const kindRow = r.getByTestName('control-kind');
  await userEvent.click(within(kindRow).getByText('l'));
  await r.findByText(/kind=l/);
  await r.unmount();
});

test('controls: edits persist across a story switch, without remounting on edit', async () => {
  const stateful = makeStory({
    exportName: 'stateful',
    name: 'stateful',
    meta: { args: { label: 'hi' } },
    render: (args: { label?: string }) => {
      const [clicks, setClicks] = useState(0);
      return (
        <box style={{ gap: 4 }}>
          <text
            onClick={() => setClicks((c) => c + 1)}
          >{`${args.label} clicked=${clicks}`}</text>
        </box>
      );
    },
  });
  const r = await renderX11(
    <WorkbenchApp initial={makeModel([knobbed, stateful])} />,
    { wrap: false },
  );

  await userEvent.click(r.getByText('stateful'));
  await r.findByText('hi clicked=0');

  // Bump internal state, then edit an arg: state must survive the edit.
  await userEvent.click(r.getByText('hi clicked=0'));
  await r.findByText('hi clicked=1');
  await userEvent.type(r.getByPlaceholder('label'), '!');
  await r.findByText('hi! clicked=1');

  // Switch away and back: the override survives, the state resets (remount).
  await userEvent.click(r.getByText('knobbed'));
  await r.findByText(/label=Told/);
  await userEvent.click(r.getByText('stateful'));
  await r.findByText('hi! clicked=0');
  await r.unmount();
});

test('controls: no args, no panel', async () => {
  const bare = makeStory({
    exportName: 'bare',
    name: 'bare',
    meta: {},
    render: () => <text>bare story</text>,
  });
  const r = await renderX11(<WorkbenchApp initial={makeModel([bare])} />, {
    wrap: false,
  });
  await userEvent.click(r.getByText('bare'));
  await r.findByText('bare story');
  await waitFor(() =>
    assert.equal(r.queryByTestName('workbench-controls'), null),
  );
  await r.unmount();
});
