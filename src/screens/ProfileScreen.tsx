import { useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { Stepper } from '../components/Stepper';
import { useAppState, useDispatch } from '../state/store';
import {
  goalPercent,
  goalRatio,
  sessionVolume,
  totalTrainingSeconds,
  totalVolume,
  trainingProgress,
  workoutById,
} from '../state/selectors';
import { formatDuration } from '../utils/date';

export function ProfileScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [confirmReset, setConfirmReset] = useState(false);

  const training = trainingProgress(state);
  const history = [...state.sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 12);

  return (
    <div className="screen">
      <AppHeader title="Профіль" subtitle={state.profile.name} />

      <div className="screen-body">
        <div className="stat-row">
          <div className="stat">
            <Icon name="trophy" size={18} />
            <span className="stat__value num">{training.done}</span>
            <span className="stat__label dim">тренувань</span>
          </div>
          <div className="stat">
            <Icon name="clock" size={18} />
            <span className="stat__value num">
              {Math.round(totalTrainingSeconds(state) / 3600)}
            </span>
            <span className="stat__label dim">годин</span>
          </div>
          <div className="stat">
            <Icon name="dumbbell" size={18} />
            <span className="stat__value num">
              {Math.round(totalVolume(state) / 1000)}
            </span>
            <span className="stat__label dim">тонн обсягу</span>
          </div>
        </div>

        <Card title="Тіло" className="section-gap">
          <div className="stepper-row">
            <Stepper
              label="Вага"
              value={state.profile.weightKg}
              step={0.5}
              min={30}
              max={250}
              suffix="кг"
              onChange={(weightKg) => dispatch({ type: 'profile/update', patch: { weightKg } })}
            />
            <Stepper
              label="Зріст"
              value={state.profile.heightCm}
              step={1}
              min={120}
              max={230}
              suffix="см"
              onChange={(heightCm) => dispatch({ type: 'profile/update', patch: { heightCm } })}
            />
          </div>
        </Card>

        <Card title="Цілі" className="section-gap stack-gap">
          {state.goals.map((goal) => (
            <div key={goal.id} className="goal-edit">
              <div className="row-between">
                <span>
                  {goal.title} — {goal.targetValue} {goal.unit}
                </span>
                <span className="num underline-accent">{goalPercent(goal)}%</span>
              </div>
              <ProgressBar ratio={goalRatio(goal)} color="var(--accent)" height={4} />
              <div className="goal-edit__controls">
                <Stepper
                  label="Зараз"
                  value={goal.currentValue}
                  step={goal.unit === 'кг' ? 0.5 : 0.5}
                  min={0}
                  max={500}
                  suffix={goal.unit}
                  onChange={(currentValue) =>
                    dispatch({ type: 'goal/update', id: goal.id, patch: { currentValue } })
                  }
                />
                <Stepper
                  label="Ціль"
                  value={goal.targetValue}
                  step={1}
                  min={1}
                  max={500}
                  suffix={goal.unit}
                  onChange={(targetValue) =>
                    dispatch({ type: 'goal/update', id: goal.id, patch: { targetValue } })
                  }
                />
              </div>
            </div>
          ))}
          {state.goals.length === 0 && <p className="empty-note">Цілей поки немає.</p>}
        </Card>

        <Card title="Тренування" className="section-gap stack-gap">
          <Toggle
            label="Звукові сигнали"
            hint="Біп на останніх секундах відпочинку"
            value={state.settings.sound}
            onChange={(sound) => dispatch({ type: 'settings/update', patch: { sound } })}
          />
          <Toggle
            label="Вібрація"
            hint="Підказка при зміні фази"
            value={state.settings.vibration}
            onChange={(vibration) => dispatch({ type: 'settings/update', patch: { vibration } })}
          />
          <Toggle
            label="Автоперехід"
            hint="Наступний підхід стартує сам після відпочинку"
            value={state.settings.autoAdvance}
            onChange={(autoAdvance) => dispatch({ type: 'settings/update', patch: { autoAdvance } })}
          />
          <Toggle
            label="Не гасити екран"
            hint="Тримати екран увімкненим під час тренування"
            value={state.settings.keepAwake}
            onChange={(keepAwake) => dispatch({ type: 'settings/update', patch: { keepAwake } })}
          />
          <div className="setting-row">
            <Stepper
              label="Підготовка перед стартом"
              value={state.settings.prepSec}
              step={5}
              min={0}
              max={60}
              suffix="с"
              onChange={(prepSec) => dispatch({ type: 'settings/update', patch: { prepSec } })}
            />
          </div>
        </Card>

        <Card title="Історія" className="section-gap">
          {history.length === 0 && <p className="empty-note">Ще жодного тренування.</p>}
          <ul className="history-list">
            {history.map((session) => {
              const workout = workoutById(state, session.workoutId);
              return (
                <li key={session.id} className="history-item">
                  <div>
                    <p className="history-item__title">
                      №{workout?.index ?? '—'} · {workout?.focus ?? 'Тренування'}
                    </p>
                    <p className="history-item__meta dim">
                      {new Date(session.startedAt).toLocaleDateString('uk-UA')} ·{' '}
                      {formatDuration(session.totalSec)} · {session.completedSets}/
                      {session.plannedSets} підходів
                    </p>
                  </div>
                  <span className="history-item__volume num">
                    {Math.round(sessionVolume(session)).toLocaleString('uk-UA')} кг
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="section-gap danger-zone">
          {confirmReset ? (
            <>
              <p className="muted danger-zone__question">
                Скинути весь прогрес і повернути демо-дані?
              </p>
              <div className="danger-zone__actions">
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Скасувати
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({ type: 'app/reset' });
                    setConfirmReset(false);
                  }}
                >
                  Скинути
                </Button>
              </div>
            </>
          ) : (
            <Button variant="danger" block onClick={() => setConfirmReset(true)}>
              Скинути прогрес
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, hint, value, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint dim">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="toggle__input"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}
