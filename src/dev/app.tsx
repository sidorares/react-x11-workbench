// The workshop window: sidebar over the discovery model, preview pane,
// theme toolbar, and error containment. Pure UI — discovery and watching
// happen outside (src/dev/index.tsx) and arrive through props, which is
// what lets the whole shell render headless under react-x11/test.

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, SplitPane, ThemeProvider } from 'react-x11';
import { Tree } from '@react-x11/components/tree';
import {
  effectiveMeta,
  type DiscoveredFile,
  type DiscoveredStory,
  type Discovery,
} from '../discovery/index.js';

export interface WorkbenchAppProps {
  initial: Discovery;
  /** Delivers a fresh Discovery after a watch-triggered reload. */
  subscribe?: (listener: (next: Discovery) => void) => () => void;
  /** The window's close button. Absent: the close request is ignored. */
  onQuit?: () => void;
}

// Sidebar ids: a file row is `file:<id>`, a story row `story:<id>#<export>`.
// Strings on purpose — they survive a reload, which object identity would
// not, and selection is restored by re-finding the same id in the new model.
const fileRowId = (file: DiscoveredFile) => `file:${file.id}`;
const storyRowId = (file: DiscoveredFile, story: DiscoveredStory) =>
  `story:${file.id}#${story.exportName}`;

interface Selected {
  file: DiscoveredFile;
  story: DiscoveredStory | null;
}

function findSelected(
  discovery: Discovery,
  rowId: string | null,
): Selected | null {
  if (rowId === null) return null;
  for (const file of discovery.files) {
    if (rowId === fileRowId(file)) return { file, story: null };
    for (const story of file.stories) {
      if (rowId === storyRowId(file, story)) return { file, story };
    }
  }
  return null;
}

export function WorkbenchApp(props: WorkbenchAppProps): ReactNode {
  const { initial, subscribe, onQuit } = props;

  // The epoch keys story remounts: a reload delivers new render functions,
  // and the boundary must drop a previous error with them.
  const [state, setState] = useState({ discovery: initial, epoch: 0 });
  const { discovery, epoch } = state;

  useEffect(() => {
    if (!subscribe) return;
    return subscribe((next) =>
      setState((prev) => ({ discovery: next, epoch: prev.epoch + 1 })),
    );
  }, [subscribe]);

  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');

  // Every file open by default; files a reload adds arrive open too, while
  // rows the user closed stay closed.
  const [expanded, setExpanded] = useState<readonly (string | number)[]>(() =>
    initial.files.map(fileRowId),
  );
  const known = useMemo(
    () => new Set(discovery.files.map(fileRowId)),
    [discovery],
  );
  useEffect(() => {
    setExpanded((prev) => {
      const seen = new Set(prev);
      const fresh = discovery.files
        .map(fileRowId)
        .filter((id) => !seen.has(id) && known.has(id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovery]);

  const items = useMemo(
    () =>
      discovery.files.map((file) => ({
        id: fileRowId(file),
        label: file.error ? `${file.title} (failed)` : file.title,
        children: file.stories.map((story) => ({
          id: storyRowId(file, story),
          label: story.name,
        })),
      })),
    [discovery],
  );

  const selected = findSelected(discovery, selectedRow);

  return (
    <window
      title="x11-workbench"
      width={1100}
      height={720}
      onCloseRequest={onQuit}
    >
      <SplitPane direction="row" defaultSize={280} min={180} minSecond={320}>
        <box style={{ flexDirection: 'column', flexGrow: 1 }}>
          <box
            style={{
              paddingStart: 12,
              paddingEnd: 12,
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            <text style={{ color: '$textMuted', fontSize: 11 }}>
              {`${discovery.files.length} files`}
            </text>
          </box>
          <Tree
            items={items}
            expanded={expanded}
            onExpandedChange={(next) => setExpanded(next)}
            selected={selectedRow}
            onSelect={(id) => setSelectedRow(String(id))}
            style={{ flexGrow: 1, minHeight: 0 }}
            data-testname="workbench-sidebar"
            aria-label="stories"
          />
        </box>
        <box style={{ flexDirection: 'column', flexGrow: 1 }}>
          <Toolbar
            selected={selected}
            scheme={scheme}
            onToggleScheme={() =>
              setScheme((s) => (s === 'light' ? 'dark' : 'light'))
            }
          />
          <Main selected={selected} scheme={scheme} epoch={epoch} />
        </box>
      </SplitPane>
    </window>
  );
}

function Toolbar(props: {
  selected: Selected | null;
  scheme: 'light' | 'dark';
  onToggleScheme: () => void;
}): ReactNode {
  const { selected, scheme, onToggleScheme } = props;
  const label = selected
    ? selected.story
      ? `${selected.file.id} · ${selected.story.name}`
      : selected.file.id
    : '';
  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingStart: 12,
        paddingEnd: 12,
        paddingTop: 6,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderColor: '$border',
      }}
    >
      <text style={{ color: '$textMuted', fontSize: 12, flexGrow: 1 }}>
        {label}
      </text>
      <Button
        label={scheme === 'light' ? 'Dark' : 'Light'}
        onPress={onToggleScheme}
      />
    </box>
  );
}

function Main(props: {
  selected: Selected | null;
  scheme: 'light' | 'dark';
  epoch: number;
}): ReactNode {
  const { selected, scheme, epoch } = props;

  if (!selected) {
    return (
      <box
        style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <text style={{ color: '$textMuted' }}>Select a story</text>
      </box>
    );
  }

  const { file, story } = selected;

  if (story === null) {
    return <FilePanel file={file} />;
  }

  const meta = effectiveMeta(file, story);
  const frame = meta.size
    ? { width: meta.size.width, height: meta.size.height }
    : { alignSelf: 'stretch' as const, flexGrow: 1 };

  return (
    <box style={{ flexGrow: 1, padding: 16, alignItems: 'flex-start' }}>
      <ThemeProvider colorScheme={scheme} style={{ ...frame }}>
        <box
          data-testname="workbench-preview"
          style={{
            flexGrow: 1,
            backgroundColor: '$background',
            borderWidth: 1,
            borderColor: '$border',
            padding: 12,
          }}
        >
          <StoryBoundary key={`${file.id}#${story.exportName}:${epoch}`}>
            <StoryView story={story} />
          </StoryBoundary>
        </box>
      </ThemeProvider>
    </box>
  );
}

/** The file view: its error when importing failed, its diagnostics always. */
function FilePanel(props: { file: DiscoveredFile }): ReactNode {
  const { file } = props;
  return (
    <box style={{ flexGrow: 1, padding: 16, flexDirection: 'column' }}>
      {file.error !== undefined ? (
        <ErrorPanel
          heading={`${file.id} failed to import`}
          error={file.error}
        />
      ) : (
        <text style={{ color: '$textMuted' }}>
          {`${file.stories.length} ${file.stories.length === 1 ? 'story' : 'stories'}`}
        </text>
      )}
      {file.diagnostics.map((diagnostic, index) => (
        <text
          key={index}
          style={{ color: '$warning', fontSize: 12, marginTop: 8 }}
        >
          {diagnostic.message}
        </text>
      ))}
    </box>
  );
}

function StoryView(props: { story: DiscoveredStory }): ReactNode {
  const { story } = props;
  return <>{story.render(story.meta.args ?? {})}</>;
}

/**
 * Per-story containment: a story that throws in render becomes a panel,
 * not a dead workshop. This includes the (for now) unsupported case of a
 * story whose root is a `<window>` — mounting one inside the preview box
 * throws, and the panel is where that is explained until the
 * nested-window preview lands.
 */
class StoryBoundary extends Component<
  { children: ReactNode },
  { error: unknown; caught: boolean }
> {
  override state = { error: undefined as unknown, caught: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, caught: true };
  }

  override render(): ReactNode {
    if (this.state.caught) {
      return <ErrorPanel heading="story crashed" error={this.state.error} />;
    }
    return this.props.children;
  }
}

function ErrorPanel(props: { heading: string; error: unknown }): ReactNode {
  const { heading, error } = props;
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  return (
    <box
      data-testname="workbench-error"
      style={{ flexDirection: 'column', padding: 4 }}
    >
      <text style={{ color: '$danger' }}>{heading}</text>
      <text
        selectable
        tabIndex={-1}
        style={{
          color: '$danger',
          fontFamily: '$monoFamily',
          fontSize: 11,
          marginTop: 8,
        }}
      >
        {detail}
      </text>
    </box>
  );
}
