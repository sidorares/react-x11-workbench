// The workshop shell, rendered headless by react-x11/test — the same
// harness the capture CLI will ride. The discovery model is hand-built:
// the shell's contract is "render whatever discovery says", so tests say
// it directly.

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { useState } from 'react';
import { Button } from 'react-x11';
import { act, cleanup, renderX11, userEvent, waitFor } from 'react-x11/test';
import { WorkbenchApp } from '../src/dev/app.js';
import type {
  DiscoveredFile,
  Discovery,
  ResolvedWorkbenchConfig,
} from '../src/discovery/index.js';
import { story } from '../src/story/index.js';

const config: ResolvedWorkbenchConfig = {
  stories: ['**/*.story.tsx'],
  decorators: [],
  themes: {},
  sizes: { default: { width: 640, height: 480 } },
  fonts: {},
  captureDir: '__screenshots__',
  path: null,
};

function file(
  partial: Partial<DiscoveredFile> & { id: string },
): DiscoveredFile {
  return {
    file: `/fake/${partial.id}`,
    title: partial.id.replace(/\.story\.tsx$/, ''),
    meta: {},
    stories: [],
    diagnostics: [],
    ...partial,
  };
}

function model(files: DiscoveredFile[]): Discovery {
  return {
    root: '/fake',
    config,
    files,
    diagnostics: files.flatMap((f) => f.diagnostics),
  };
}

const alpha = file({
  id: 'alpha.story.tsx',
  title: 'Alpha',
  stories: [
    {
      exportName: 'one',
      name: 'one',
      meta: {},
      render: () => <text>alpha one lives</text>,
      wrapped: false,
    },
    {
      exportName: 'two',
      name: 'Two named',
      meta: story(() => null, { name: 'Two named' }).meta,
      render: () => <text>alpha two lives</text>,
      wrapped: true,
    },
  ],
});

const broken = file({
  id: 'broken.story.tsx',
  title: 'broken',
  error: new Error('kaput at import'),
  diagnostics: [
    { file: 'broken.story.tsx', message: 'failed to import: kaput at import' },
  ],
});

const angry = file({
  id: 'angry.story.tsx',
  title: 'angry',
  stories: [
    {
      exportName: 'boom',
      name: 'boom',
      meta: {},
      render: () => {
        throw new Error('render boom');
      },
      wrapped: false,
    },
  ],
});

after(() => cleanup());

test('the sidebar lists files and stories; selecting one previews it', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([alpha, broken])} />, {
    wrap: false,
  });

  // Files open by default: story rows are visible without a click.
  r.getByText('Alpha');
  r.getByText('broken (failed)');
  const row = r.getByText('Two named');

  assert.equal(r.queryByText('alpha two lives'), null);
  await userEvent.click(row);
  await r.findByText('alpha two lives');
  await r.unmount();
});

test('a file that failed to import shows its error, not a crash', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([alpha, broken])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('broken (failed)'));
  // Both the stack panel and the diagnostic mention it; either proves the
  // error is on screen.
  const hits = await waitFor(() => r.getAllByText(/kaput at import/));
  assert.ok(hits.length >= 1);
  // The shell is still alive around the panel.
  r.getByText('Alpha');
  await r.unmount();
});

test('a story that throws in render is contained by the boundary', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([angry, alpha])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('boom'));
  await r.findByText('story crashed');
  await r.findByText(/render boom/);

  // Another story still renders after the crash. Exact: the boundary's
  // stack text would substring-match a bare 'one'.
  await userEvent.click(r.getByText('one', { exact: true }));
  await r.findByText('alpha one lives');
  await r.unmount();
});

test('the theme toggle flips its own label', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([alpha])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('one', { exact: true }));
  await r.findByText('alpha one lives');
  await userEvent.click(r.getByRole('button', { name: 'Dark' }));
  await r.findByRole('button', { name: 'Light' });
  await r.unmount();
});

test('an interactive story owns its hook state', async () => {
  const stateful = file({
    id: 'stateful.story.tsx',
    title: 'Stateful',
    stories: [
      {
        exportName: 'counter',
        name: 'counter',
        meta: {},
        wrapped: false,
        render: () => {
          const [n, setN] = useState(0);
          return (
            <box style={{ gap: 8 }}>
              <text>{`count is ${n}`}</text>
              <Button label="inc" onPress={() => setN(n + 1)} />
            </box>
          );
        },
      },
    ],
  });

  const r = await renderX11(<WorkbenchApp initial={model([stateful])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('counter'));
  await r.findByText('count is 0');
  await userEvent.click(r.getByRole('button', { name: 'inc' }));
  await r.findByText('count is 1');
  await r.unmount();
});

test('grid: selecting a file shows every story of it at once', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([alpha])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('Alpha'));
  await r.findByText('alpha one lives');
  await r.findByText('alpha two lives');
  await r.unmount();
});

test('grid: the theme axis doubles the cells with labelled schemes', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([alpha])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('Alpha'));
  await r.findByText('alpha one lives');
  assert.equal(r.getAllByText('alpha one lives').length, 1);

  await userEvent.click(r.getByRole('button', { name: 'Both themes' }));
  await waitFor(() => {
    assert.equal(r.getAllByText('alpha one lives').length, 2);
    assert.equal(r.getAllByText('alpha two lives').length, 2);
  });
  r.getByText('one · light');
  r.getByText('one · dark');

  await userEvent.click(r.getByRole('button', { name: 'One theme' }));
  await waitFor(() =>
    assert.equal(r.getAllByText('alpha one lives').length, 1),
  );
  await r.unmount();
});

test('split: pin holds one story while the sidebar changes the other', async () => {
  const r = await renderX11(<WorkbenchApp initial={model([alpha])} />, {
    wrap: false,
  });

  await userEvent.click(r.getByText('one', { exact: true }));
  await r.findByText('alpha one lives');
  await userEvent.click(r.getByRole('button', { name: 'Pin' }));

  // Pinned == current: the same story sits in both panes.
  await waitFor(() =>
    assert.equal(r.getAllByText('alpha one lives').length, 2),
  );

  // The sidebar now changes only the second pane.
  await userEvent.click(r.getByText('Two named'));
  await r.findByText('alpha two lives');
  r.getByText('alpha one lives');

  // The pinned pane owns its own theme.
  await userEvent.click(r.getByRole('button', { name: 'Pinned: light' }));
  await r.findByRole('button', { name: 'Pinned: dark' });
  r.getByText('alpha one lives');

  await userEvent.click(r.getByRole('button', { name: 'Unpin' }));
  await waitFor(() => assert.equal(r.queryByText('alpha one lives'), null));
  r.getByText('alpha two lives');
  await r.unmount();
});

test('a subscribed update reaches the sidebar and remounts the preview', async () => {
  let push: ((next: Discovery) => void) | null = null;
  const subscribe = (listener: (next: Discovery) => void) => {
    push = listener;
    return () => {
      push = null;
    };
  };

  const r = await renderX11(
    <WorkbenchApp initial={model([alpha])} subscribe={subscribe} />,
    { wrap: false },
  );

  await userEvent.click(r.getByText('one', { exact: true }));
  await r.findByText('alpha one lives');

  const reloadedAlpha = file({
    ...alpha,
    stories: [
      {
        exportName: 'one',
        name: 'one',
        meta: {},
        render: () => <text>alpha one reloaded</text>,
        wrapped: false,
      },
    ],
  });
  const added = file({ id: 'zeta.story.tsx', title: 'Zeta' });

  assert.ok(push, 'the app subscribed');
  await act(() => push!(model([reloadedAlpha, added])));

  await waitFor(() => r.getByText('Zeta'));
  await r.findByText('alpha one reloaded');
  assert.equal(r.queryByText('alpha one lives'), null);
  await r.unmount();
});
