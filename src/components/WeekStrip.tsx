import type { WeekDay } from '../state/selectors';
import { WEEKDAY_SHORT } from '../utils/date';
import { Icon } from './Icon';

interface Props {
  days: WeekDay[];
  selectedIso?: string;
  onSelect?: (day: WeekDay) => void;
}

export function WeekStrip({ days, selectedIso, onSelect }: Props) {
  return (
    <div className="week-strip">
      {days.map((day, index) => {
        const selected = selectedIso ? day.iso === selectedIso : day.isToday;
        const classes = [
          'week-day',
          selected ? 'week-day--selected' : '',
          day.isToday ? 'week-day--today' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={day.iso}
            type="button"
            className={classes}
            onClick={() => onSelect?.(day)}
            aria-current={day.isToday ? 'date' : undefined}
            aria-label={`${WEEKDAY_SHORT[index]} ${day.date.getDate()}`}
          >
            <span className="week-day__name">{WEEKDAY_SHORT[index]}</span>
            <span className="week-day__circle num">{day.date.getDate()}</span>
            <span className="week-day__mark">
              {day.isDone ? (
                <Icon name="check" size={11} className="week-day__check" />
              ) : day.hasWorkout ? (
                <i className="week-day__dot" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
