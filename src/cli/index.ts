#!/usr/bin/env node
// The x11-workbench CLI. `ls` is the only command so far — the discovery
// module made visible. `dev` (M1) and `capture` (M3) land here later.

import process from 'node:process';
import { register } from 'tsx/esm/api';
import { discover, type Discovery } from '../discovery/index.js';

// Story files and workbench.config.ts are TypeScript, and this bin may be
// run by plain node — install tsx's loader before discovery imports any of
// them. (Registration affects later dynamic imports; the static imports
// above are compiled JavaScript and never need it.)
register();

function usage(): never {
  console.error('usage: x11-workbench <ls|dev> [--json] [root]');
  process.exit(2);
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case 'ls':
    await ls(rest);
    break;
  case 'dev':
    await dev(rest);
    break;
  default:
    usage();
}

async function dev(argv: string[]): Promise<void> {
  if (argv.some((arg) => arg.startsWith('--'))) usage();
  if (argv.length > 1) usage();
  // Imported lazily: the workshop pulls in react-x11 and the components
  // package, none of which `ls` should pay for.
  const { runDev } = await import('../dev/index.js');
  try {
    await runDev({ root: argv[0] });
  } catch (error) {
    console.error(
      'could not start the workshop:',
      error instanceof Error ? error.message : String(error),
    );
    console.error('(the workshop needs a running X server — is $DISPLAY set?)');
    process.exit(1);
  }
  console.log('workshop running — watching for story changes (ctrl-c quits)');
}

async function ls(argv: string[]): Promise<void> {
  const json = argv.includes('--json');
  const positional = argv.filter((arg) => arg !== '--json');
  if (positional.some((arg) => arg.startsWith('--'))) usage();
  if (positional.length > 1) usage();

  const discovery = await discover({ root: positional[0] });

  if (json) {
    console.log(JSON.stringify(serialize(discovery), null, 2));
  } else {
    print(discovery);
  }

  // Diagnostics are advice; a module that failed to import is a failure.
  process.exitCode = discovery.files.some((file) => file.error) ? 1 : 0;
}

function print(discovery: Discovery): void {
  if (discovery.files.length === 0) {
    console.log(
      `no story files matched ${discovery.config.stories.join(', ')} under ${discovery.root}`,
    );
    return;
  }

  let count = 0;
  for (const file of discovery.files) {
    console.log(`${file.title} — ${file.id}`);
    for (const story of file.stories) {
      count += 1;
      const marks = [
        story.meta.args !== undefined ? 'args' : null,
        story.meta.play !== undefined ? 'play' : null,
        story.meta.capture !== undefined ? 'capture' : null,
      ].filter((mark) => mark !== null);
      console.log(
        `  · ${story.name}${marks.length > 0 ? `  (${marks.join(', ')})` : ''}`,
      );
    }
    if (file.error) console.log('  ! failed to import');
  }
  console.log(
    `${count} ${count === 1 ? 'story' : 'stories'} in ${discovery.files.length} ${
      discovery.files.length === 1 ? 'file' : 'files'
    }`,
  );

  for (const diagnostic of discovery.diagnostics) {
    console.error(`! ${diagnostic.file}: ${diagnostic.message}`);
  }
}

/** The JSON shape: the model minus functions and live error objects. */
function serialize(discovery: Discovery): unknown {
  return {
    root: discovery.root,
    config: {
      ...discovery.config,
      // Functions do not serialize; say how many there were instead.
      decorators: discovery.config.decorators.length,
    },
    files: discovery.files.map((file) => ({
      id: file.id,
      title: file.title,
      meta: file.meta,
      stories: file.stories.map((story) => ({
        exportName: story.exportName,
        name: story.name,
        wrapped: story.wrapped,
        args: story.meta.args,
        controls: story.meta.controls,
        hasPlay: story.meta.play !== undefined,
        capture: story.meta.capture,
      })),
      error: file.error === undefined ? undefined : String(file.error),
      diagnostics: file.diagnostics.map((diagnostic) => diagnostic.message),
    })),
  };
}
