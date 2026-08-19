// Same rung, with a named helper export beside it: the helper is not a
// story the author meant, but every named function export of a discovered
// file is one — which is the cost of pointing globs at source, and is
// worth seeing in a test.

export const measure = (n: number) => n * 2;

export default function Panel() {
  return null;
}
