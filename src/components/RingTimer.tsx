import type { ReactNode } from 'react';

/** Stroke width in viewBox units — the SVG itself is sized by CSS. */
const STROKE = 6;
const RADIUS = (100 - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  /** 0..1 — share of the ring that is filled. */
  ratio: number;
  color: string;
  className?: string;
  children: ReactNode;
}

/**
 * A circular progress ring. It draws into a normalised viewBox so the size
 * comes from CSS — that lets the runner shrink it on short screens.
 */
export function RingTimer({ ratio, color, className, children }: Props) {
  const filled = Math.max(0, Math.min(1, ratio));

  return (
    <div className={`ring${className ? ` ${className}` : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="var(--bg-elevated-2)"
          strokeWidth={STROKE}
        />
        <circle
          className="ring__progress"
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="ring__content">{children}</div>
    </div>
  );
}
