// Screenshot the workshop itself, headless — the workbench's own
// dogfooding of the capture path M3 will productize. Real discovery over
// this repo's stories/, real clicks to reach a view, then toPNG.
//
//   npx tsx scripts/shot.tsx out.png --select product --controls
//
// Fonts are pinned to Bitstream Vera so the shot is the same on every
// machine (fc-match otherwise answers differently per host).

import * as React from 'react';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { act, cleanup, renderX11, toPNG, userEvent } from 'react-x11/test';
import { discover } from '../src/discovery/index.js';
import { WorkbenchApp } from '../src/dev/app.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const out = argv[0] ?? 'shot.png';
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const flag = (name: string) => argv.includes(`--${name}`);

const width = Number(opt('width') ?? 1100);
const height = Number(opt('height') ?? 720);

const FONTS = {
  'sans-serif': '/opt/X11/share/fonts/TTF/Vera.ttf',
  monospace: '/opt/X11/share/fonts/TTF/VeraMono.ttf',
};

const discovery = await discover({ root });

const r = await renderX11(
  <WorkbenchApp initial={discovery} width={width} height={height} />,
  {
    wrap: false,
    width,
    height,
    fonts: FONTS,
    colorScheme: (opt('scheme') as 'light' | 'dark') ?? 'light',
  },
);

const select = opt('select');
if (select) {
  await userEvent.click(r.getByText(select, { exact: true }));
}
if (flag('dark')) {
  await userEvent.click(r.getByRole('button', { name: 'Dark' }));
}
if (flag('both')) {
  await userEvent.click(r.getByRole('button', { name: 'Both themes' }));
}
if (flag('pin')) {
  await userEvent.click(r.getByRole('button', { name: 'Pin' }));
  const then = opt('then');
  if (then) await userEvent.click(r.getByText(then, { exact: true }));
}
await act();

await toPNG(r.ctx, path.resolve(out), { width, height });
console.log(`wrote ${out} (${width}×${height})`);

await r.unmount();
await cleanup();
