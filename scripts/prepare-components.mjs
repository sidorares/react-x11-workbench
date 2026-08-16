// A git install of @react-x11/components ships `src/` but no `dist/`: its
// build runs on `prepack`, and npm runs only the `prepare` lifecycle for
// git dependencies. Until upstream adds a `prepare` script, this builds the
// slice of the package the workbench imports, using this repo's own
// TypeScript. Extend ENTRIES as the workbench consumes more components.
//
// Runs on postinstall; a no-op when the package is absent (nothing
// installed yet) or already built (a future published version, or a
// previous run).

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRIES = ['tree'];

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.join(
  here,
  '..',
  'node_modules',
  '@react-x11',
  'components',
);

if (!existsSync(path.join(pkgDir, 'src'))) process.exit(0);
if (
  ENTRIES.every((e) => existsSync(path.join(pkgDir, 'dist', e, 'index.js')))
) {
  process.exit(0);
}

// Mirrors the package's own tsconfig.build.json, except skipLibCheck (their
// declarations are checked in their repo, not here) and the narrowed
// include. `src/internal` is their shared-code directory (no subpath of its
// own) that tree imports.
const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    lib: ['ES2022', 'ESNext.Disposable'],
    jsx: 'react-jsx',
    jsxImportSource: 'react-x11',
    strict: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    skipLibCheck: true,
    types: ['node'],
    rootDir: 'src',
    outDir: 'dist',
    declaration: true,
    declarationMap: true,
    sourceMap: true,
  },
  include: [...ENTRIES.map((e) => `src/${e}`), 'src/internal'],
};

writeFileSync(
  path.join(pkgDir, 'tsconfig.workbench.json'),
  JSON.stringify(tsconfig, null, 2),
);

const require_ = createRequire(import.meta.url);
const tsc = path.join(
  path.dirname(require_.resolve('typescript/package.json')),
  'bin',
  'tsc',
);
console.log(
  `building @react-x11/components (${ENTRIES.join(', ')}) from git src…`,
);
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.workbench.json'], {
  cwd: pkgDir,
  stdio: 'inherit',
});
