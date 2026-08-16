import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { discover, loadConfig, loadStoryFile } from '../src/discovery/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, 'fixtures', name);

test('loadConfig merges the file over the defaults', async () => {
  const config = await loadConfig(fixture('basic-repo'));
  assert.deepEqual(config.stories, ['stories/**/*.story.tsx']);
  assert.equal(config.captureDir, 'shots'); // from the file
  assert.deepEqual(config.sizes, { default: { width: 640, height: 480 } }); // a default
  assert.ok(config.path?.endsWith('workbench.config.ts'));
});

test('loadConfig without a file is all defaults', async () => {
  const config = await loadConfig(fixture('no-config-repo'));
  assert.equal(config.path, null);
  assert.deepEqual(config.stories, ['**/*.story.tsx']);
  assert.equal(config.captureDir, '__screenshots__');
});

test('discover: files sorted by id; node_modules and non-matches excluded', async () => {
  const discovery = await discover({ root: fixture('basic-repo') });
  assert.deepEqual(
    discovery.files.map((file) => file.id),
    [
      'stories/bad-default.story.tsx',
      'stories/broken.story.tsx',
      'stories/plain.story.tsx',
      'stories/table.story.tsx',
    ],
  );
});

test('discover: plain and wrapped exports of one file', async () => {
  const discovery = await discover({ root: fixture('basic-repo') });
  const table = discovery.files.find((f) => f.id.endsWith('table.story.tsx'));
  assert.ok(table);
  assert.equal(table.title, 'Table'); // FileMeta wins over the basename
  // Module-namespace order is export-name order, per spec.
  assert.deepEqual(
    table.stories.map((story) => story.exportName),
    ['basic', 'withKnobs'],
  );

  const [basic, withKnobs] = table.stories;
  assert.equal(basic!.wrapped, false);
  assert.equal(basic!.name, 'basic');
  assert.deepEqual(basic!.meta, {});

  assert.equal(withKnobs!.wrapped, true);
  assert.equal(withKnobs!.name, 'With knobs');
  assert.deepEqual(withKnobs!.meta.args, { rows: 3 });
  assert.deepEqual(withKnobs!.meta.controls, { rows: 'number' });

  // The off-contract data export is a diagnostic, not a story.
  assert.ok(
    table.diagnostics.some((d) => d.message.includes("'fixtures'")),
    'expected a diagnostic naming the non-function export',
  );
});

test('discover: a module that throws is a diagnosed file, not a crash', async () => {
  const discovery = await discover({ root: fixture('basic-repo') });
  const broken = discovery.files.find((f) => f.id.endsWith('broken.story.tsx'));
  assert.ok(broken);
  assert.ok(broken.error instanceof Error);
  assert.deepEqual(broken.stories, []);
  assert.ok(broken.diagnostics.some((d) => d.message.includes('boom')));
});

test('discover: a default-exported component is diagnosed, its siblings kept', async () => {
  const discovery = await discover({ root: fixture('basic-repo') });
  const bad = discovery.files.find((f) =>
    f.id.endsWith('bad-default.story.tsx'),
  );
  assert.ok(bad);
  assert.deepEqual(
    bad.stories.map((story) => story.exportName),
    ['ok'],
  );
  assert.ok(bad.diagnostics.some((d) => d.message.includes('default export')));
});

test('discover: title derives from the basename when there is no FileMeta', async () => {
  const discovery = await discover({ root: fixture('basic-repo') });
  const plain = discovery.files.find((f) => f.id.endsWith('plain.story.tsx'));
  assert.equal(plain?.title, 'plain');
  assert.deepEqual(
    plain?.stories.map((story) => story.name),
    ['first', 'second'],
  );
});

test('discover: the default glob walks a configless repo', async () => {
  const discovery = await discover({ root: fixture('no-config-repo') });
  assert.deepEqual(
    discovery.files.map((file) => file.id),
    ['nested/deep.story.tsx', 'root.story.tsx'],
  );
  assert.equal(discovery.files[0]?.title, 'Deep');
});

test('loadStoryFile: the same URL is cached; a bust re-evaluates', async () => {
  const root = fixture('bust');
  const file = path.join(root, 'counter.story.tsx');
  const g = globalThis as { __wbCounter?: number };
  delete g.__wbCounter;

  await loadStoryFile(file, root);
  await loadStoryFile(file, root);
  assert.equal(g.__wbCounter, 1, 'unbusted imports share one evaluation');

  await loadStoryFile(file, root, { bust: 'a' });
  assert.equal(g.__wbCounter, 2, 'a fresh bust value re-evaluates');

  await loadStoryFile(file, root, { bust: 'a' });
  assert.equal(g.__wbCounter, 2, 'the same bust value is cached again');
});
