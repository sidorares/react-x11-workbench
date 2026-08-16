import { story } from '../../../../src/story/index.js';

export default { title: 'Table' };

export const basic = () => null;

export const withKnobs = story((_args: { rows: number }) => null, {
  name: 'With knobs',
  args: { rows: 3 },
  controls: { rows: 'number' },
});

// Off-contract on purpose: a named export that is not a function should
// surface as a diagnostic, never vanish silently.
export const fixtures = [1, 2, 3];
