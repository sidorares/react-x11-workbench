// An interactive story: state lives inside it, because a story mounts as
// a component of its own — hooks work, and switching stories resets them.

import { useState } from 'react';
import { Button } from 'react-x11';
import { story } from '../src/story/index.js';

export default { title: 'Counter' };

export const interactive = story(
  () => {
    const [count, setCount] = useState(0);
    return (
      <box style={{ gap: 8, alignItems: 'flex-start' }}>
        <text>{`clicked ${count} ${count === 1 ? 'time' : 'times'}`}</text>
        <Button primary label="Count" onPress={() => setCount(count + 1)} />
      </box>
    );
  },
  { size: { width: 320, height: 160 } },
);
