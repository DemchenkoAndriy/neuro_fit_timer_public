/**
 * Small inline icon set — no icon dependency, so the bundle stays tiny and
 * every glyph inherits currentColor.
 */
export type IconName =
  | 'home'
  | 'calendar'
  | 'meal'
  | 'user'
  | 'play'
  | 'pause'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'plus'
  | 'minus'
  | 'skip'
  | 'flame'
  | 'clock'
  | 'trophy'
  | 'dumbbell';

const PATHS: Record<IconName, string> = {
  home: 'M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar:
    'M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
  meal: 'M7 3v9a2 2 0 0 0 2 2v7M11 3v6M15 3v18M18 3c1.5 1.5 2 3.5 2 6s-1 4-2 4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  play: 'M8 5.5 19 12 8 18.5z',
  pause: 'M9 5v14M15 5v14',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  chevronLeft: 'M15 5 8 12l7 7',
  chevronRight: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  flame: 'M12 22c4 0 6-2.6 6-6 0-4.5-4-6-4-10-3 1.5-4 4-4 6-1-.6-1.5-1.6-1.5-3C6 10 6 12 6 16c0 3.4 2 6 6 6z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  trophy:
    'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 21h6M12 14v7',
  dumbbell: 'M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10',
};

const FILLED: IconName[] = ['play', 'skip'];

interface Props {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 22, className }: Props) {
  const filled = FILLED.includes(name);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
