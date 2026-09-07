import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useAppState } from '../state/store';
import { dateForWorkout, sessionForWorkout, sessionVolume, workoutById } from '../state/selectors';
import { plannedSets } from '../data/program';
import { formatDuration, formatLongDate } from '../utils/date';

export function WorkoutScreen() {
  const { workoutId } = useParams();
  const state = useAppState();
  const navigate = useNavigate();

  const workout = workoutId ? workoutById(state, workoutId) : undefined;

  if (!workout) {
    return (
      <div className="screen">
        <AppHeader title="Тренування" left={<BackButton />} />
        <div className="screen-body">
          <p className="empty-note">Тренування не знайдено.</p>
        </div>
      </div>
    );
  }

  const session = sessionForWorkout(state, workout.id);
  const date = dateForWorkout(state, workout);
  const sets = plannedSets(workout);
  const running = state.run?.workoutId === workout.id;

  return (
    <div className="screen">
      <AppHeader
        title={`Тренування №${workout.index}`}
        subtitle={`${workout.focus} · тиждень ${workout.week}`}
        left={<BackButton />}
      />

      <div className="screen-body">
        <p className="dim workout-date">{formatLongDate(date)}</p>

        <div className="stat-row">
          <Stat icon="dumbbell" value={`${workout.exercises.length}`} label="вправ" />
          <Stat icon="check" value={`${sets}`} label="підходів" />
          <Stat icon="clock" value={`${workout.durationMin}`} label="хвилин" />
        </div>

        {session && (
          <div className="done-banner">
            <Icon name="check" size={18} />
            <div>
              <p className="done-banner__title">Виконано</p>
              <p className="done-banner__meta muted">
                {formatDuration(session.totalSec)} · {session.completedSets}/{session.plannedSets}{' '}
                підходів · {Math.round(sessionVolume(session)).toLocaleString('uk-UA')} кг обсягу
              </p>
            </div>
          </div>
        )}

        <ol className="exercise-list exercise-list--detailed">
          {workout.exercises.map((exercise, i) => {
            const log = session?.logs.find((entry) => entry.exerciseId === exercise.id);
            return (
              <li key={exercise.id} className="exercise-card">
                <div className="exercise-card__head">
                  <span className="exercise-card__index num">{i + 1}</span>
                  <div>
                    <p className="exercise-card__name">{exercise.name}</p>
                    <p className="exercise-card__sets muted">
                      {exercise.sets} × {exercise.repsMin}-{exercise.repsMax} повторень
                      {exercise.weightKg > 0 ? ` · ${exercise.weightKg} кг` : ' · власна вага'}
                    </p>
                  </div>
                </div>
                <div className="exercise-card__tags">
                  <span className="tag">
                    <Icon name="clock" size={13} /> відпочинок {exercise.restSec} с
                  </span>
                  {exercise.hint && <span className="tag tag--muted">{exercise.hint}</span>}
                </div>
                {log && (
                  <p className="exercise-card__log num">
                    {log.sets.map((set, index) => (
                      <span key={index} className="log-chip">
                        {set.reps}
                        {set.weightKg > 0 ? `×${set.weightKg}` : ''}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <Button variant="primary" block onClick={() => navigate(`/run/${workout.id}`)}>
          <Icon name="play" size={18} />
          {running ? 'Продовжити тренування' : session ? 'Пройти ще раз' : 'Почати тренування'}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: 'dumbbell' | 'check' | 'clock';
  value: string;
  label: string;
}) {
  return (
    <div className="stat">
      <Icon name={icon} size={18} />
      <span className="stat__value num">{value}</span>
      <span className="stat__label dim">{label}</span>
    </div>
  );
}
