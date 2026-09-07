import type { ReactNode } from 'react';

interface Props {
  /** 0..1 — share of the ring that is filled. */
  ratio: number;
  color: string;
  size?: number;
  stroke?: number;
  children: ReactNode;
}

export function RingTimer({ ratio, color, size = 240, stroke = 12, children }: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, ratio));

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-elevated-2)"
          strokeWidth={stroke}
        />
        <circle
          className="ring__progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__content">{children}</div>
    </div>
  );
}
