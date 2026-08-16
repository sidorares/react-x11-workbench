// Counts its own evaluations, so tests can see when the module cache was
// actually busted.

const g = globalThis as { __wbCounter?: number };
g.__wbCounter = (g.__wbCounter ?? 0) + 1;

export const counted = () => null;
