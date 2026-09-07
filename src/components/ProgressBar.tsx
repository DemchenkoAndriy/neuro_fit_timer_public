interface Props {
  /** 0..1 */
  ratio: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ ratio, color = 'var(--accent)', height = 6 }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div
      className="progress-bar"
      style={{ height }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
