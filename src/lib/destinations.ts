import type { IconName } from './icons';
import type { Destination } from './types';

/** The colors a teacher can give a destination: a strong shade for icons and a soft one behind them. */
export const destinationColors = {
  green: { strong: '#1e6b43', soft: '#e1f0e6' },
  blue: { strong: '#2361a6', soft: '#e1ecf8' },
  teal: { strong: '#0f6f68', soft: '#dbf1ee' },
  purple: { strong: '#6a4cbb', soft: '#ece6f8' },
  pink: { strong: '#b03a68', soft: '#f8e2eb' },
  orange: { strong: '#b4530b', soft: '#fbebd9' },
  yellow: { strong: '#86680a', soft: '#f8f0cb' },
  gray: { strong: '#4b5563', soft: '#eceef0' },
} as const;

export type DestinationColor = keyof typeof destinationColors;

/** The icons a teacher can give a destination. */
export const destinationIcons = [
  'toilet',
  'droplet',
  'building-2',
  'heart-handshake',
  'stethoscope',
  'book-open',
  'utensils',
  'dumbbell',
  'music',
  'laptop',
  'backpack',
  'map-pin',
] as const satisfies readonly IconName[];

export type DestinationIcon = (typeof destinationIcons)[number];

/** Every new account starts with these, so students can sign out on day one. */
export function defaultDestinations(newId: () => string): Destination[] {
  return [
    { id: newId(), label: 'Restroom', minutes: 5, color: 'blue', icon: 'toilet' },
    { id: newId(), label: 'Water', minutes: 3, color: 'teal', icon: 'droplet' },
    { id: newId(), label: 'Office', minutes: 10, color: 'orange', icon: 'building-2' },
    { id: newId(), label: 'Counselor', minutes: 15, color: 'purple', icon: 'heart-handshake' },
    { id: newId(), label: 'Nurse', minutes: 15, color: 'pink', icon: 'stethoscope' },
  ];
}

/**
 * How a pass's destination should look. Passes keep the destination's name, so
 * history still reads correctly if the destination is renamed or removed; a
 * name no longer on the list is drawn in grey.
 */
export function lookFor(destinations: Destination[], label: string) {
  const match = destinations.find((destination) => destination.label === label);
  const color = destinationColors[match?.color ?? 'gray'];
  return { icon: (match?.icon ?? 'map-pin') as IconName, strong: color.strong, soft: color.soft };
}
