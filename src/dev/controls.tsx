// The controls panel: interactive props for the selected story. Entries
// come from the story's declared `controls`, plus inference from `args` —
// a string arg is a text control, a number arg a number, a boolean a
// switch — so `args` alone already buys knobs (the ladder's rule: the
// declaration is for saying *more*, not for permission).
//
// Edits are overrides over `meta.args`, owned by the app keyed by story
// row id: they survive reloads and story switching, and Reset drops them.
// The story is NOT remounted on an edit — its state survives tweaking,
// which is the point of tweaking.

import type { ReactNode } from 'react';
import { Button, RadioGroup, Radio, Slider, Switch } from 'react-x11';
import type { DiscoveredStory } from '../discovery/index.js';
import type { ControlSpec } from '../story/index.js';

export interface ControlEntry {
  key: string;
  spec: ControlSpec;
}

function inferSpec(value: unknown): ControlSpec | null {
  switch (typeof value) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return null; // objects, functions, undefined: not editable here
  }
}

/** What the panel shows for a story — empty means no panel. */
export function controlEntries(story: DiscoveredStory): ControlEntry[] {
  const args = (story.meta.args ?? {}) as Record<string, unknown>;
  const declared = (story.meta.controls ?? {}) as Record<
    string,
    ControlSpec | undefined
  >;
  const keys = [
    ...Object.keys(declared),
    ...Object.keys(args).filter((key) => !(key in declared)),
  ];
  const entries: ControlEntry[] = [];
  for (const key of keys) {
    const spec = declared[key] ?? inferSpec(args[key]);
    if (spec) entries.push({ key, spec });
  }
  return entries;
}

export function ControlsPanel(props: {
  story: DiscoveredStory;
  entries: ControlEntry[];
  overrides: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
}): ReactNode {
  const { story, entries, overrides, onChange, onReset } = props;
  const args = (story.meta.args ?? {}) as Record<string, unknown>;

  return (
    <box
      data-testname="workbench-controls"
      style={{
        width: 300,
        flexDirection: 'column',
        backgroundColor: '$surface',
        padding: 12,
        gap: 12,
        overflow: 'scroll',
      }}
    >
      <box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <text style={{ flexGrow: 1, color: '$textMuted', fontSize: 12 }}>
          Controls
        </text>
        <Button
          label="Reset"
          disabled={Object.keys(overrides).length === 0}
          onPress={onReset}
        />
      </box>
      {entries.map((entry) => (
        <ControlRow
          key={entry.key}
          entry={entry}
          value={
            entry.key in overrides ? overrides[entry.key] : args[entry.key]
          }
          onChange={(value) => onChange(entry.key, value)}
        />
      ))}
    </box>
  );
}

function ControlRow(props: {
  entry: ControlEntry;
  value: unknown;
  onChange: (value: unknown) => void;
}): ReactNode {
  const { entry, value, onChange } = props;
  return (
    <box
      data-testname={`control-${entry.key}`}
      style={{ flexDirection: 'column', gap: 4 }}
    >
      <text style={{ color: '$textMuted', fontSize: 11 }}>{entry.key}</text>
      <ControlEditor entry={entry} value={value} onChange={onChange} />
    </box>
  );
}

function ControlEditor(props: {
  entry: ControlEntry;
  value: unknown;
  onChange: (value: unknown) => void;
}): ReactNode {
  const { entry, value, onChange } = props;
  const { key, spec } = entry;

  if (Array.isArray(spec)) {
    const options = spec as readonly (string | number)[];
    return (
      <RadioGroup
        value={value}
        onChange={(ev) => onChange(ev.value)}
        aria-label={key}
      >
        {options.map((option) => (
          <Radio key={String(option)} value={option} label={String(option)} />
        ))}
      </RadioGroup>
    );
  }

  if (spec === 'boolean') {
    return (
      <Switch
        checked={Boolean(value)}
        onChange={(ev) => onChange(ev.value)}
        aria-label={key}
      />
    );
  }

  const boundedSpec = typeof spec === 'object' && 'type' in spec ? spec : null;
  if (
    boundedSpec &&
    boundedSpec.min !== undefined &&
    boundedSpec.max !== undefined
  ) {
    const { min, max, step } = boundedSpec;
    const current = typeof value === 'number' ? value : min;
    return (
      <box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Slider
          value={current}
          min={min}
          max={max}
          step={step}
          onChange={(ev) => onChange(ev.value)}
          style={{ flexGrow: 1 }}
          aria-label={key}
        />
        <text style={{ color: '$textMuted', fontSize: 11 }}>
          {String(current)}
        </text>
      </box>
    );
  }

  const numeric = spec === 'number' || boundedSpec !== null;
  return (
    <textinput
      value={value === undefined ? '' : String(value)}
      placeholder={key}
      onChange={(ev) => {
        if (!numeric) {
          onChange(ev.value);
          return;
        }
        const parsed = Number(ev.value);
        if (ev.value.trim() !== '' && Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
    />
  );
}
