// The failure surface: an import that threw, or a story that threw while
// rendering. Its own module because it is a component with states worth
// looking at — `stories/workbench-ui.story.tsx` previews it in the
// workbench itself.

import type { ReactNode } from 'react';
import { FONT, SPACE } from './ui.js';

export function ErrorPanel(props: {
  heading: string;
  error: unknown;
}): ReactNode {
  const { heading, error } = props;
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  return (
    <box
      data-testname="workbench-error"
      style={{ flexDirection: 'column', gap: SPACE.tight }}
    >
      <text style={{ color: '$danger', fontWeight: 600 }}>{heading}</text>
      <text
        selectable
        tabIndex={-1}
        style={{
          color: '$textMuted',
          fontFamily: '$monoFamily',
          fontSize: FONT.meta,
          lineHeight: 1.5,
        }}
      >
        {detail}
      </text>
    </box>
  );
}
