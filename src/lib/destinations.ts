import { destinationIconGroups, type IconName } from './icons';
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

/** Every icon a teacher can give a destination, in picker order. */
export const destinationIcons = Object.values(destinationIconGroups).flat();

export type DestinationIcon = (typeof destinationIcons)[number];

/** Icons renamed by newer versions of Lucide, so older saved destinations keep theirs. */
const renamedIcons: Record<string, DestinationIcon> = { 'building-2': 'building' };

/** A saved icon name that is still on the list, or the closest stand-in. */
export function knownIcon(name: string): DestinationIcon {
  if ((destinationIcons as readonly string[]).includes(name)) return name as DestinationIcon;
  return renamedIcons[name] ?? 'map-pin';
}

/** Every new account starts with these, so students can sign out on day one. */
export function defaultDestinations(newId: () => string): Destination[] {
  return [
    { id: newId(), label: 'Bathroom', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 },
  ];
}

/** "1 at a time", or "No limit" for a destination any number of students may go to at once. */
export function limitText(destination: Destination) {
  return destination.limit === null ? 'No limit' : `${destination.limit} at a time`;
}

/**
 * How a pass's destination should look. Passes keep the destination's name, so
 * history still reads correctly if the destination is renamed or removed; a
 * name no longer on the list is drawn in grey.
 */
export function lookFor(destinations: Destination[], label: string) {
  const match = destinations.find((destination) => destination.label === label);
  const color = destinationColors[match?.color ?? 'gray'];
  return { icon: knownIcon(match?.icon ?? 'map-pin') as IconName, strong: color.strong, soft: color.soft };
}
