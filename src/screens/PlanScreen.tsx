import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { useAppState } from '../state/store';
import {
  currentWeek,
  dateForWorkout,
  isWorkoutDone,
  trainingProgress,
} from '../state/selectors';
import { plannedSets } from '../data/program';
import { WEEKDAY_SHORT, isoWeekday, isSameDay } from '../utils/date';

export function PlanScreen() {
  const state = useAppState();
  const today = new Date();
  const thisWeek = currentWeek(state, today);
  const [week, setWeek] = useState(thisWeek);

  const training = trainingProgress(state);
  const weekWorkouts = state.program.workouts.filter((workout) => workout.week === week);

  return (
    <div className="screen">
      <AppHeader
        title="План"
        subtitle={`${state.program.weeks} тижні · ${state.program.daysPerWeek} тренування на тиждень`}
      />

      <div className="screen-body">
        <div className="plan-summary">
          <div className="row-between">
            <span className="muted">Виконано тренувань</span>
            <span className="num">
              {training.done}/{training.total}
            </span>
          </div>
          <ProgressBar ratio={training.ratio} color="var(--accent)" />
        </div>

        <div className="week-tabs" role="tablist" aria-label="Тижні програми">
          {Array.from({ length: state.program.weeks }, (_, i) => i + 1).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={value === week}
              className={`week-tab${value === week ? ' week-tab--active' : ''}`}
              onClick={() => setWeek(value)}
            >
              Тиждень {value}
              {value === thisWeek && <i className="week-tab__dot" />}
            </button>
          ))}
        </div>

        <ul className="plan-list">
          {weekWorkouts.map((workout) => {
            const date = dateForWorkout(state, workout);
            const done = isWorkoutDone(state, workout.id);
            const isToday = isSameDay(date, today);
            return (
              <li key={workout.id}>
                <Link
                  to={`/workout/${workout.id}`}
                  className={`plan-item${done ? ' plan-item--done' : ''}${
                    isToday ? ' plan-item--today' : ''
                  }`}
                >
                  <div className="plan-item__day">
                    <span className="plan-item__weekday">
                      {WEEKDAY_SHORT[isoWeekday(date) - 1]}
                    </span>
                    <span className="plan-item__date num">{date.getDate()}</span>
                  </div>
                  <div className="plan-item__body">
                    <p className="plan-item__title">
                      Тренування №{workout.index} · {workout.focus}
                    </p>
                    <p className="plan-item__meta muted">
                      {workout.exercises.length} вправ · {plannedSets(workout)} підходів ·{' '}
                      {workout.durationMin} хв
                    </p>
                  </div>
                  <span className="plan-item__state">
                    {done ? (
                      <Icon name="check" size={20} className="plan-item__check" />
                    ) : (
                      <Icon name="chevronRight" size={18} />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="rest-note">
          <Icon name="clock" size={16} />
          <span>
            Дні без тренувань — відновлення. Тримай харчування та сон, м'язи ростуть саме тоді.
          </span>
        </div>
      </div>
    </div>
  );
}
