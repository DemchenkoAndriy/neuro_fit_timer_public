import type { ReactNode } from 'react';

/** Default stroke width in viewBox units — the SVG itself is sized by CSS. */
const STROKE = 6;

interface Props {
  /** 0..1 — share of the ring that is filled. */
  ratio: number;
  color: string;
  /** Stroke width in viewBox units; a heavier ring reads as more urgent. */
  thickness?: number;
  className?: string;
  children: ReactNode;
}

/**
 * A circular progress ring. It draws into a normalised viewBox so the size
 * comes from CSS — that lets the runner shrink it on short screens.
 */
export function RingTimer({ ratio, color, thickness = STROKE, className, children }: Props) {
  const filled = Math.max(0, Math.min(1, ratio));
  const radius = (100 - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`ring${className ? ` ${className}` : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--bg-elevated-2)"
          strokeWidth={thickness}
        />
        <circle
          className="ring__progress"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="ring__content">{children}</div>
    </div>
  );
}
