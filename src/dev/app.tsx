// The workshop window: sidebar over the discovery model, preview pane,
// theme toolbar, the compare views, and error containment. Pure UI —
// discovery and watching happen outside (src/dev/index.tsx) and arrive
// through props, which is what lets the whole shell render headless under
// react-x11/test.
//
// The two compare views (PRD §The workshop GUI):
// - grid: selecting a *file* shows every story of it at once, in labelled
//   cells, optionally under both themes — the timeline example's
//   hand-built Gallery, formalized;
// - split: Pin holds the current story in one pane while the sidebar
//   changes the other, each pane owning its own theme — which is also how
//   one story is compared against itself in light and dark.

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, SplitPane, ThemeProvider } from 'react-x11';
import { Tree } from '@react-x11/components/tree';
import { controlEntries, ControlsPanel } from './controls.js';
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

type Scheme = 'light' | 'dark';

// Sidebar ids: a file row is `file:<id>`, a story row `story:<id>#<export>`.
// Strings on purpose — they survive a reload, which object identity would
// not, and selection (and the pin) is restored by re-finding the same id in
// the new model.
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
  const [scheme, setScheme] = useState<Scheme>('light');
  const [pinned, setPinned] = useState<{
    rowId: string;
    scheme: Scheme;
  } | null>(null);
  const [bothThemes, setBothThemes] = useState(false);

  // Live control edits, keyed by story row id: overrides over meta.args.
  // Kept across story switches and reloads; Reset drops one story's.
  const [overridesByRow, setOverridesByRow] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // Every file open by default; files a reload adds arrive open too, while
  // rows the user closed stay closed.
  const [expanded, setExpanded] = useState<readonly (string | number)[]>(() =>
    initial.files.map(fileRowId),
  );
  useEffect(() => {
    setExpanded((prev) => {
      const seen = new Set(prev);
      const fresh = discovery.files
        .map(fileRowId)
        .filter((id) => !seen.has(id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }, [discovery]);

  // A pin outlives reloads by id; a story the reload removed unpins.
  useEffect(() => {
    if (pinned && !findSelected(discovery, pinned.rowId)?.story) {
      setPinned(null);
    }
  }, [discovery, pinned]);

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
  const pinnedSelected = pinned ? findSelected(discovery, pinned.rowId) : null;

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
            pinned={pinned !== null}
            onTogglePin={() => {
              if (pinned) {
                setPinned(null);
              } else if (selected?.story && selectedRow) {
                setPinned({ rowId: selectedRow, scheme });
              }
            }}
            bothThemes={bothThemes}
            onToggleBothThemes={() => setBothThemes((b) => !b)}
          />
          <Main
            selected={selected}
            pinnedSelected={pinnedSelected?.story ? pinnedSelected : null}
            pinnedScheme={pinned?.scheme ?? 'light'}
            onTogglePinnedScheme={() =>
              setPinned((p) =>
                p
                  ? { ...p, scheme: p.scheme === 'light' ? 'dark' : 'light' }
                  : p,
              )
            }
            scheme={scheme}
            epoch={epoch}
            bothThemes={bothThemes}
            overridesByRow={overridesByRow}
            onArgChange={(rowId, key, value) =>
              setOverridesByRow((prev) => ({
                ...prev,
                [rowId]: { ...prev[rowId], [key]: value },
              }))
            }
            onResetArgs={(rowId) =>
              setOverridesByRow((prev) => {
                const { [rowId]: _dropped, ...rest } = prev;
                return rest;
              })
            }
          />
        </box>
      </SplitPane>
    </window>
  );
}

function Toolbar(props: {
  selected: Selected | null;
  scheme: Scheme;
  onToggleScheme: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  bothThemes: boolean;
  onToggleBothThemes: () => void;
}): ReactNode {
  const {
    selected,
    scheme,
    onToggleScheme,
    pinned,
    onTogglePin,
    bothThemes,
    onToggleBothThemes,
  } = props;
  const label = selected
    ? selected.story
      ? `${selected.file.id} · ${selected.story.name}`
      : selected.file.id
    : '';
  const gridControls =
    selected !== null &&
    selected.story === null &&
    selected.file.stories.length > 0;
  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
      {(selected?.story || pinned) && (
        <Button label={pinned ? 'Unpin' : 'Pin'} onPress={onTogglePin} />
      )}
      {gridControls && (
        <Button
          label={bothThemes ? 'One theme' : 'Both themes'}
          onPress={onToggleBothThemes}
        />
      )}
      <Button
        label={scheme === 'light' ? 'Dark' : 'Light'}
        onPress={onToggleScheme}
      />
    </box>
  );
}

function Main(props: {
  selected: Selected | null;
  pinnedSelected: Selected | null;
  pinnedScheme: Scheme;
  onTogglePinnedScheme: () => void;
  scheme: Scheme;
  epoch: number;
  bothThemes: boolean;
  overridesByRow: Record<string, Record<string, unknown>>;
  onArgChange: (rowId: string, key: string, value: unknown) => void;
  onResetArgs: (rowId: string) => void;
}): ReactNode {
  const {
    selected,
    pinnedSelected,
    pinnedScheme,
    onTogglePinnedScheme,
    scheme,
    epoch,
    bothThemes,
    overridesByRow,
    onArgChange,
    onResetArgs,
  } = props;

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
    return (
      <GridPanel
        file={file}
        scheme={scheme}
        bothThemes={bothThemes}
        epoch={epoch}
        overridesByRow={overridesByRow}
      />
    );
  }

  const rowId = storyRowId(file, story);
  const overrides = overridesByRow[rowId] ?? {};
  const entries = controlEntries(story);

  // In a split, the panel edits the *current* pane; the pinned pane reads
  // its own row's overrides, so it only moves when both panes are the same
  // story — which is then exactly what a same-story compare wants.
  const content = pinnedSelected?.story ? (
    <SplitPane direction="row" defaultSize={430} min={220} minSecond={220}>
      <ComparePane
        title={`${pinnedSelected.file.id} · ${pinnedSelected.story.name}`}
        action={
          <Button
            label={`pinned: ${pinnedScheme}`}
            onPress={onTogglePinnedScheme}
          />
        }
      >
        <StoryFrame
          file={pinnedSelected.file}
          story={pinnedSelected.story}
          scheme={pinnedScheme}
          epoch={epoch}
          overrides={
            overridesByRow[
              storyRowId(pinnedSelected.file, pinnedSelected.story)
            ]
          }
        />
      </ComparePane>
      <ComparePane title={`${file.id} · ${story.name}`}>
        <StoryFrame
          file={file}
          story={story}
          scheme={scheme}
          epoch={epoch}
          overrides={overrides}
        />
      </ComparePane>
    </SplitPane>
  ) : (
    <box style={{ flexGrow: 1, padding: 16, alignItems: 'flex-start' }}>
      <StoryFrame
        file={file}
        story={story}
        scheme={scheme}
        epoch={epoch}
        overrides={overrides}
      />
    </box>
  );

  return (
    <box style={{ flexGrow: 1, flexDirection: 'row', minHeight: 0 }}>
      <box style={{ flexGrow: 1, flexDirection: 'column', minWidth: 0 }}>
        {content}
      </box>
      {entries.length > 0 && (
        <ControlsPanel
          story={story}
          entries={entries}
          overrides={overrides}
          onChange={(key, value) => onArgChange(rowId, key, value)}
          onReset={() => onResetArgs(rowId)}
        />
      )}
    </box>
  );
}

function ComparePane(props: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const { title, action, children } = props;
  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingStart: 12,
          paddingEnd: 12,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        <text style={{ color: '$textMuted', fontSize: 11, flexGrow: 1 }}>
          {title}
        </text>
        {action}
      </box>
      <box
        style={{
          flexGrow: 1,
          overflow: 'scroll',
          padding: 12,
          alignItems: 'flex-start',
        }}
      >
        {children}
      </box>
    </box>
  );
}

/**
 * The grid: every story of one file at once — and with `bothThemes`, every
 * story twice, light beside dark. Cells take their width from the story's
 * declared size, with a readable default for the undeclared.
 */
function GridPanel(props: {
  file: DiscoveredFile;
  scheme: Scheme;
  bothThemes: boolean;
  epoch: number;
  overridesByRow: Record<string, Record<string, unknown>>;
}): ReactNode {
  const { file, scheme, bothThemes, epoch, overridesByRow } = props;

  if (file.error !== undefined) {
    return (
      <box style={{ flexGrow: 1, padding: 16, flexDirection: 'column' }}>
        <ErrorPanel
          heading={`${file.id} failed to import`}
          error={file.error}
        />
        <Diagnostics file={file} />
      </box>
    );
  }

  if (file.stories.length === 0) {
    return (
      <box style={{ flexGrow: 1, padding: 16, flexDirection: 'column' }}>
        <text style={{ color: '$textMuted' }}>no stories in this file</text>
        <Diagnostics file={file} />
      </box>
    );
  }

  const schemes: Scheme[] = bothThemes ? ['light', 'dark'] : [scheme];

  return (
    <box style={{ flexGrow: 1, overflow: 'scroll', padding: 16 }}>
      <box
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {file.stories.flatMap((story) =>
          schemes.map((cellScheme) => (
            <box
              key={`${story.exportName}:${cellScheme}`}
              style={{
                flexDirection: 'column',
                width: effectiveMeta(file, story).size?.width ?? 340,
              }}
            >
              <text
                style={{ color: '$textMuted', fontSize: 11, marginBottom: 4 }}
              >
                {schemes.length > 1
                  ? `${story.name} · ${cellScheme}`
                  : story.name}
              </text>
              <StoryFrame
                file={file}
                story={story}
                scheme={cellScheme}
                epoch={epoch}
                overrides={overridesByRow[storyRowId(file, story)]}
              />
            </box>
          )),
        )}
      </box>
      <Diagnostics file={file} />
    </box>
  );
}

function Diagnostics(props: { file: DiscoveredFile }): ReactNode {
  const { file } = props;
  return (
    <>
      {file.diagnostics.map((diagnostic, index) => (
        <text
          key={index}
          style={{ color: '$warning', fontSize: 12, marginTop: 8 }}
        >
          {diagnostic.message}
        </text>
      ))}
    </>
  );
}

/** One story in its themed, bordered frame — the unit every view shares. */
function StoryFrame(props: {
  file: DiscoveredFile;
  story: DiscoveredStory;
  scheme: Scheme;
  epoch: number;
  overrides?: Record<string, unknown>;
}): ReactNode {
  const { file, story, scheme, epoch, overrides } = props;
  const meta = effectiveMeta(file, story);
  const frame = meta.size
    ? { width: meta.size.width, height: meta.size.height }
    : { alignSelf: 'stretch' as const, flexGrow: 1 };

  return (
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
        <StoryBoundary
          key={`${file.id}#${story.exportName}:${scheme}:${epoch}`}
        >
          <StoryView story={story} overrides={overrides} />
        </StoryBoundary>
      </box>
    </ThemeProvider>
  );
}

function StoryView(props: {
  story: DiscoveredStory;
  overrides?: Record<string, unknown>;
}): ReactNode {
  const { story, overrides } = props;
  // Mounted as a component, not called as a function: a story is a
  // component and its args are props, so hooks inside it get their own
  // identity instead of leaking into StoryView's. Control edits arrive as
  // overrides over meta.args — new props, same mount, so story state
  // survives the tweaking.
  const Render = story.render;
  return <Render {...(story.meta.args ?? {})} {...(overrides ?? {})} />;
}

/**
 * Per-story containment: a story that throws in render becomes a panel,
 * not a dead workshop. This also names the out-of-scope case: the
 * workbench previews components — something that renders inside another
 * react-x11 component — and a story whose root is a `<window>` (a whole
 * app) throws here rather than being embedded (decided 2026-08-16).
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
