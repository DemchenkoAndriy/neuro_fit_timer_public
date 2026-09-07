import { Icon } from './Icon';

interface Props {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export function Stepper({
  label,
  value,
  step = 1,
  min = 0,
  max = 999,
  suffix,
  onChange,
}: Props) {
  const clamp = (next: number) => Math.max(min, Math.min(max, Math.round(next * 100) / 100));

  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(clamp(value - step))}
          aria-label={`${label}: менше`}
        >
          <Icon name="minus" size={18} />
        </button>
        <span className="stepper__value num">
          {value}
          {suffix && <span className="stepper__suffix">{suffix}</span>}
        </span>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(clamp(value + step))}
          aria-label={`${label}: більше`}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}
