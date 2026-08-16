// The controls demo: every editor kind on one card — text, a bounded
// number (slider), a switch, options. 'title' needs no declaration; its
// string arg already infers the text control.

import { Button } from 'react-x11';
import { story } from '../src/story/index.js';

export default { title: 'Card' };

const ACCENTS: Record<string, string> = {
  white: '#f4f4f4',
  grey: '#485353',
  yellow: '#d9a520',
};

export const product = story(
  (args: {
    title: string;
    outOfStock: boolean;
    padding: number;
    accent: string;
  }) => (
    <box
      style={{
        width: 300,
        padding: args.padding,
        gap: 8,
        backgroundColor: '$surface',
        borderWidth: 1,
        borderColor: '$border',
        borderRadius: 6,
      }}
    >
      <box style={{ flexDirection: 'row', gap: 6 }}>
        {Object.entries(ACCENTS).map(([name, colour]) => (
          <box
            key={name}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colour,
              borderWidth: args.accent === name ? 2 : 1,
              borderColor: args.accent === name ? '$accent' : '$border',
            }}
          />
        ))}
      </box>
      <text style={{ fontSize: 18 }}>{args.title}</text>
      <text style={{ color: '$textMuted' }}>
        {args.outOfStock ? 'Out of stock' : 'In stock'}
      </text>
      <text style={{ fontSize: 16 }}>$120.00</text>
      <Button
        primary
        disabled={args.outOfStock}
        label={args.outOfStock ? 'Unavailable' : 'Add to cart'}
      />
    </box>
  ),
  {
    args: {
      title: 'Space Helmet X24',
      outOfStock: false,
      padding: 12,
      accent: 'white',
    },
    controls: {
      outOfStock: 'boolean',
      padding: { type: 'number', min: 0, max: 40 },
      accent: ['white', 'grey', 'yellow'],
    },
  },
);
