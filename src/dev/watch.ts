// The file watcher behind watch-restart: any change to a source file under
// the root schedules one debounced reload. Deliberately coarser than the
// story globs — a story imports helpers the globs never match, so the
// filter is "a source file, not in a place builds write to".

import fs from 'node:fs';
import path from 'node:path';

const SOURCE = /\.(tsx|ts|mts|jsx|js|mjs)$/;
const IGNORED = /(^|\/)(node_modules|\.git|dist|__screenshots__)(\/|$)/;

export function watchStories(
  root: string,
  onChange: () => void,
  options: { debounceMs?: number } = {},
): () => void {
  const debounceMs = options.debounceMs ?? 150;
  let timer: NodeJS.Timeout | null = null;

  const watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const id = filename.split(path.sep).join('/');
    if (IGNORED.test(id) || !SOURCE.test(id)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  });

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
