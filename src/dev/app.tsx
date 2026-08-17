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
import { ErrorPanel } from './error-panel.js';
import { CHROME_BG, FONT, HAIRLINE, SPACE } from './ui.js';
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
  /** Opening size. A real window is resized by the WM after this; tests
   * and the screenshot script pass it to lay out at a chosen size. */
  width?: number;
  height?: number;
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
  const { initial, subscribe, onQuit, width = 1100, height = 720 } = props;

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
  const storyCount = discovery.files.reduce(
    (total, file) => total + file.stories.length,
    0,
  );

  return (
    <window
      title="x11-workbench"
      width={width}
      height={height}
      onCloseRequest={onQuit}
    >
      <SplitPane direction="row" defaultSize={260} min={180} minSecond={320}>
        <box
          style={{
            flexDirection: 'column',
            flexGrow: 1,
            backgroundColor: CHROME_BG,
            borderEndWidth: HAIRLINE.width,
            borderColor: HAIRLINE.color,
          }}
        >
          <box
            style={{
              paddingStart: SPACE.row,
              paddingEnd: SPACE.row,
              paddingTop: SPACE.row,
              paddingBottom: SPACE.tight,
              gap: 2,
            }}
          >
            <text style={{ fontSize: FONT.body, fontWeight: 600 }}>
              workbench
            </text>
            <text style={{ color: '$textMuted', fontSize: FONT.meta }}>
              {`${storyCount} ${storyCount === 1 ? 'story' : 'stories'} in ${discovery.files.length} ${discovery.files.length === 1 ? 'file' : 'files'}`}
            </text>
          </box>
          <Tree
            items={items}
            expanded={expanded}
            onExpandedChange={(next) => setExpanded(next)}
            selected={selectedRow}
            onSelect={(id) => setSelectedRow(String(id))}
            renderLabel={(row) => (
              <box
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: SPACE.tight,
                }}
              >
                <text
                  style={{
                    fontSize: FONT.body,
                    // Files are the groups, stories the things in them.
                    fontWeight: row.depth === 0 ? 600 : 400,
                  }}
                >
                  {String(row.item.label ?? '')}
                </text>
                {pinned?.rowId === row.id && (
                  <text
                    style={{
                      fontSize: FONT.meta,
                      color: row.selected ? row.color : '$textMuted',
                    }}
                  >
                    pinned
                  </text>
                )}
              </box>
            )}
            style={{ flexGrow: 1, minHeight: 0 }}
            data-testname="workbench-sidebar"
            aria-label="stories"
          />
        </box>
        <box style={{ flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
          <Toolbar
            selected={selected}
            scheme={scheme}
            onToggleScheme={() =>
              setScheme((s) => (s === 'light' ? 'dark' : 'light'))
            }
            pinned={pinned !== null}
            pinnedScheme={pinned?.scheme ?? 'light'}
            onTogglePinnedScheme={() =>
              setPinned((p) =>
                p
                  ? { ...p, scheme: p.scheme === 'light' ? 'dark' : 'light' }
                  : p,
              )
            }
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

/** One spelling of "which story is this", everywhere it is said. */
function Breadcrumb(props: { path: string; name?: string | null }): ReactNode {
  const { path, name } = props;
  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        flexGrow: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <text style={{ color: '$textMuted', fontSize: FONT.meta }}>{path}</text>
      {name && (
        <>
          <text
            style={{
              color: '$textMuted',
              fontSize: FONT.meta,
              marginStart: 6,
              marginEnd: 6,
            }}
          >
            /
          </text>
          <text style={{ fontSize: FONT.meta, fontWeight: 600 }}>{name}</text>
        </>
      )}
    </box>
  );
}

function Toolbar(props: {
  selected: Selected | null;
  scheme: Scheme;
  onToggleScheme: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  pinnedScheme: Scheme;
  onTogglePinnedScheme: () => void;
  bothThemes: boolean;
  onToggleBothThemes: () => void;
}): ReactNode {
  const {
    selected,
    scheme,
    onToggleScheme,
    pinned,
    onTogglePin,
    pinnedScheme,
    onTogglePinnedScheme,
    bothThemes,
    onToggleBothThemes,
  } = props;
  const path = selected ? selected.file.id : '';
  const name = selected?.story ? selected.story.name : null;
  const gridControls =
    selected !== null &&
    selected.story === null &&
    selected.file.stories.length > 0;
  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.tight,
        paddingStart: SPACE.pane,
        paddingEnd: SPACE.row,
        paddingTop: SPACE.tight,
        paddingBottom: SPACE.tight,
        backgroundColor: CHROME_BG,
        borderBottomWidth: HAIRLINE.width,
        borderColor: HAIRLINE.color,
      }}
    >
      <Breadcrumb path={path} name={name} />
      {pinned && (
        <Button
          label={`Pinned: ${pinnedScheme}`}
          onPress={onTogglePinnedScheme}
        />
      )}
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
    scheme,
    epoch,
    bothThemes,
    overridesByRow,
    onArgChange,
    onResetArgs,
  } = props;

  if (!selected) {
    return <EmptyState />;
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
        path={pinnedSelected.file.id}
        name={pinnedSelected.story.name}
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
      <ComparePane path={file.id} name={story.name}>
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
    <Canvas>
      <StoryFrame
        file={file}
        story={story}
        scheme={scheme}
        epoch={epoch}
        overrides={overrides}
      />
    </Canvas>
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

/**
 * Nothing selected yet — the first screen a newcomer sees, so it names the
 * three things the sidebar can do rather than saying only "select a story".
 */
function EmptyState(): ReactNode {
  const hints: [string, string][] = [
    ['a story', 'preview it on its own'],
    ['a file', 'see all its stories side by side'],
    ['Pin', 'hold one story and compare another against it'],
  ];
  return (
    <box
      style={{
        flexGrow: 1,
        backgroundColor: CHROME_BG,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <box style={{ gap: SPACE.hair, maxWidth: 360 }}>
        <text
          style={{
            fontSize: FONT.body,
            fontWeight: 600,
            marginBottom: SPACE.tight,
          }}
        >
          Select a story
        </text>
        {hints.map(([what, does]) => (
          <box
            key={what}
            style={{ flexDirection: 'row', alignItems: 'baseline' }}
          >
            <text style={{ fontSize: FONT.meta, fontWeight: 600, width: 56 }}>
              {what}
            </text>
            <text
              style={{ fontSize: FONT.meta, color: '$textMuted', flexGrow: 1 }}
            >
              {does}
            </text>
          </box>
        ))}
      </box>
    </box>
  );
}

/**
 * The canvas: the tinted ground a story surface sits on. Tinted rather
 * than white because the story frame is `$background` — the contrast is
 * what shows the component's bounds without drawing a border around it,
 * and a border there read as frame-in-frame against a story with a border
 * of its own.
 */
function Canvas(props: { children: ReactNode }): ReactNode {
  return (
    <box
      style={{
        flexGrow: 1,
        minWidth: 0,
        backgroundColor: CHROME_BG,
        padding: SPACE.canvas,
        alignItems: 'flex-start',
        overflow: 'scroll',
      }}
    >
      {props.children}
    </box>
  );
}

function ComparePane(props: {
  path: string;
  name: string;
  children: ReactNode;
}): ReactNode {
  const { path, name, children } = props;
  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACE.tight,
          paddingStart: SPACE.row,
          paddingEnd: SPACE.row,
          // A fixed height, not padding: the two panes' canvases must
          // start at the same y or the comparison is off by a header.
          height: 30,
          backgroundColor: CHROME_BG,
          borderBottomWidth: HAIRLINE.width,
          borderColor: HAIRLINE.color,
        }}
      >
        <Breadcrumb path={path} name={name} />
      </box>
      <Canvas>{children}</Canvas>
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
    <box
      style={{
        flexGrow: 1,
        minWidth: 0,
        overflow: 'scroll',
        padding: SPACE.canvas,
        backgroundColor: CHROME_BG,
      }}
    >
      <box
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: SPACE.canvas,
          alignItems: 'flex-start',
        }}
      >
        {file.stories.flatMap((story) =>
          schemes.map((cellScheme) => (
            <box
              key={`${story.exportName}:${cellScheme}`}
              style={{ flexDirection: 'column', gap: SPACE.hair }}
            >
              <text style={{ color: '$textMuted', fontSize: FONT.meta }}>
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
  // `size` is the room the *story* gets. It must therefore live on a box of
  // its own, inside the padded one: sizing is border-box, so putting
  // `size` and `padding` on the same box hands the story `size` minus the
  // padding — 248 of a declared 280 — and a child that cannot shrink that
  // far then spills out of a frame which, being fixed-size, cannot grow to
  // meet it. The workbench's own controls-panel story is the case that
  // showed it.
  const inner = meta.size
    ? {
        width: meta.size.width,
        height: meta.size.height,
        // A story bigger than the room it declared scrolls inside it —
        // what it would do in an app given that space, and better than
        // painting outside the frame as if nothing were wrong. Costs
        // nothing when it fits: no track is drawn unless it overflows.
        overflow: 'scroll' as const,
      }
    : {};

  return (
    <ThemeProvider colorScheme={scheme} style={{ alignSelf: 'flex-start' }}>
      <box
        data-testname="workbench-preview"
        style={{
          backgroundColor: '$background',
          // Ink as well as ground: text colour cascades down the *node*
          // tree, so without this a story previewed in the opposite scheme
          // to the chrome inherits the chrome's ink and paints dark text on
          // a dark card. Only explicitly-tokened colours flip on their own.
          color: '$text',
          borderRadius: 6,
          padding: SPACE.pane,
        }}
      >
        <box data-testname="workbench-story" style={inner}>
          <StoryBoundary
            key={`${file.id}#${story.exportName}:${scheme}:${epoch}`}
          >
            <StoryView story={story} overrides={overrides} />
          </StoryBoundary>
        </box>
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
