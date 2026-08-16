// Demo stories: core's <Button> in its states. Select the file row for
// the grid, a story row for one variant. In a consuming repo the import
// is '@react-x11/workbench/story'; here it is relative so the stories run
// without a prior build.

import { Button } from 'react-x11';
import { story } from '../src/story/index.js';

export default { title: 'Buttons' };

export const primary = () => <Button primary label="Save" />;

export const plain = () => <Button label="Cancel" />;

export const disabled = () => <Button disabled label="Unavailable" />;

export const fromArgs = story(
  (args: { label: string }) => <Button label={args.label} />,
  { name: 'From args', args: { label: 'Told by args' } },
);
