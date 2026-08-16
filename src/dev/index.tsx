// `x11-workbench dev` — discovery, the watcher and the root, wired to the
// pure UI in app.tsx. Needs a real $DISPLAY; the headless story is the
// test suite's (react-x11/test renders WorkbenchApp itself).

import path from 'node:path';
import process from 'node:process';
import { createRoot } from 'react-x11';
import { discover, loadConfig, type Discovery } from '../discovery/index.js';
import { watchStories } from './watch.js';
import { WorkbenchApp } from './app.js';

export interface DevOptions {
  root?: string;
}

export interface DevSession {
  close(): Promise<void>;
}

export async function runDev(options: DevOptions = {}): Promise<DevSession> {
  const root = path.resolve(options.root ?? process.cwd());

  // The config is read once per session: reloading it means re-importing a
  // cached module, and half-applying an edited config (globs yes,
  // decorators no) is worse than saying "restart for config changes".
  const config = await loadConfig(root);
  const initial = await discover({ root, config });

  const listeners = new Set<(next: Discovery) => void>();
  let epoch = 0;
  let reloading = false;
  const stopWatching = watchStories(root, () => {
    if (reloading) return;
    reloading = true;
    void discover({ root, config, bust: String(++epoch) })
      .then((next) => {
        for (const listener of listeners) listener(next);
      })
      .catch((error: unknown) => console.error('reload failed:', error))
      .finally(() => {
        reloading = false;
      });
  });

  const appRoot = await createRoot();
  const close = async (): Promise<void> => {
    stopWatching();
    await appRoot.unmount();
  };

  appRoot.render(
    <WorkbenchApp
      initial={initial}
      subscribe={(listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }}
      onQuit={() => {
        void close();
      }}
    />,
  );

  return { close };
}
