import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { WeekStrip } from '../components/WeekStrip';
import { Button } from '../components/Button';
import { useAppState } from '../state/store';
import {
  dateForWorkout,
  goalPercent,
  goalRatio,
  nutritionProgress,
  todaysWorkout,
  trainingProgress,
  weekDays,
} from '../state/selectors';
import { formatLongDate, isSameDay, toISODate } from '../utils/date';

export function HomeScreen() {
  const state = useAppState();
  const navigate = useNavigate();
  const today = new Date();

  const training = trainingProgress(state);
  const nutrition = nutritionProgress(state);
  const days = weekDays(state, today);
  const workout = todaysWorkout(state, today);
  const workoutDay = workout ? dateForWorkout(state, workout) : null;
  const isToday = workoutDay ? isSameDay(workoutDay, today) : false;
  const running = state.run?.workoutId === workout?.id;

  return (
    <div className="screen">
      <AppHeader
        title="The Project Hill"
        subtitle={state.program.name}
        left={
          <span className="brand-mark">
            <Icon name="dumbbell" size={22} />
          </span>
        }
        right={
          <Link to="/profile" className="icon-btn" aria-label="Профіль">
            <Icon name="user" size={22} />
          </Link>
        }
      />

      <div className="screen-body">
        <Card title="Прогрес" className="stack-gap">
          <ProgressRow
            label="Прогрес харчування"
            value={`${nutrition.done}/${nutrition.total}`}
            ratio={nutrition.ratio}
            color="var(--success)"
          />
          <ProgressRow
            label="Прогрес тренувань"
            value={`${training.done}/${training.total}`}
            ratio={training.ratio}
            color="var(--accent)"
            highlighted
          />
        </Card>

        <Card title="Ціль" className="stack-gap section-gap">
          {state.goals.map((goal) => (
            <div key={goal.id} className="goal-row">
              <div className="goal-row__head">
                <span className="goal-row__title">
                  {goal.title} {goal.targetValue} {goal.unit}
                </span>
                <span className="goal-row__now dim">
                  зараз {goal.currentValue} {goal.unit}
                </span>
                <span className="goal-row__pct num underline-accent">{goalPercent(goal)}%</span>
              </div>
              <ProgressBar ratio={goalRatio(goal)} color="var(--accent)" height={4} />
            </div>
          ))}
          {state.goals.length === 0 && (
            <p className="empty-note">Цілей ще немає — додай їх у профілі.</p>
          )}
        </Card>

        <div className="section-gap">
          <WeekStrip
            days={days}
            onSelect={(day) => {
              const target = day.workouts[0];
              if (target) navigate(`/workout/${target.id}`);
              else navigate(`/nutrition?date=${day.iso}`);
            }}
          />
        </div>

        {workout ? (
          <section className="today section-gap">
            <p className="section-label today__kicker">
              {isToday ? 'Сьогодні' : 'Наступне тренування'}
            </p>
            <p className="today__date dim">
              {formatLongDate(workoutDay ?? today)}
            </p>

            <h2 className="today__title">Тренування №{workout.index}</h2>
            <p className="today__focus muted">{workout.focus}</p>

            <ol className="exercise-list">
              {workout.exercises.map((exercise, i) => (
                <li key={exercise.id} className="exercise-item">
                  <p className="exercise-item__name">
                    {i + 1}. {exercise.name}
                  </p>
                  <p className="exercise-item__sets muted">
                    {exercise.sets} підходи по {exercise.repsMin}-{exercise.repsMax} повторень
                    {exercise.hint ? ` (${exercise.hint.toLowerCase()})` : ''}
                  </p>
                </li>
              ))}
            </ol>

            <p className="today__duration">Час тренування {workout.durationMin} хвилин</p>

            <div className="today__actions">
              <Button variant="primary" block onClick={() => navigate(`/run/${workout.id}`)}>
                <Icon name="play" size={18} />
                {running ? 'Продовжити' : 'Старт'}
              </Button>
              <Link to={`/workout/${workout.id}`} className="today__details">
                Деталі тренування
              </Link>
            </div>
          </section>
        ) : (
          <section className="today section-gap">
            <div className="finished-card">
              <Icon name="trophy" size={34} />
              <h2 className="finished-card__title">Програму завершено!</h2>
              <p className="muted">
                Усі {training.total} тренувань зроблено. Можна повторити цикл або скласти новий
                план у профілі.
              </p>
            </div>
          </section>
        )}

        <Link to={`/nutrition?date=${toISODate(today)}`} className="quick-link section-gap">
          <Icon name="meal" size={20} />
          <span>Відмітити харчування за сьогодні</span>
          <Icon name="chevronRight" size={18} />
        </Link>
      </div>
    </div>
  );
}

interface ProgressRowProps {
  label: string;
  value: string;
  ratio: number;
  color: string;
  highlighted?: boolean;
}

function ProgressRow({ label, value, ratio, color, highlighted }: ProgressRowProps) {
  return (
    <div className="progress-row">
      <div className="row-between">
        <span className={highlighted ? 'underline-accent' : undefined}>{label}</span>
        <span className={`num${highlighted ? ' underline-accent' : ''}`}>{value}</span>
      </div>
      <ProgressBar ratio={ratio} color={color} height={4} />
    </div>
  );
}
