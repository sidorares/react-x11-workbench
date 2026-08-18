// The bottom rung, dogfooded: a component module that says nothing about
// the workbench — no FileMeta, no `story()`, no import from the tool — and
// is a story anyway, because its default export is a component. This is
// the shape of a file the workshop finds when its globs are pointed at
// `src/` rather than at story files.

export default function Badge() {
  return (
    <box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <box
        style={{
          backgroundColor: '$accent',
          paddingStart: 10,
          paddingEnd: 10,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: 10,
        }}
      >
        <text style={{ color: '$background', fontSize: 13 }}>Ready</text>
      </box>
      <text style={{ color: '$textMuted', fontSize: 11 }}>
        no story file, no ceremony
      </text>
    </box>
  );
}
