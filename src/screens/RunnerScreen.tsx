import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { RingTimer } from '../components/RingTimer';
import { Stepper } from '../components/Stepper';
import { useAppState, useDispatch } from '../state/store';
import { workoutById } from '../state/selectors';
import { useWorkoutRunner } from '../hooks/useWorkoutRunner';
import { useAudioCue } from '../hooks/useAudioCue';
import { useVibrate } from '../hooks/useVibrate';
import { useWakeLock } from '../hooks/useWakeLock';
import { formatClock, formatDuration } from '../utils/date';
import type { RunPhase, Session, Workout } from '../types';

const PHASE_COLOR: Record<RunPhase, string> = {
  prep: 'var(--accent)',
  work: 'var(--success)',
  rest: 'var(--info)',
  done: 'var(--success)',
};

const PHASE_LABEL: Record<RunPhase, string> = {
  prep: 'Приготуйся',
  work: 'Робочий підхід',
  rest: 'Відпочинок',
  done: 'Готово',
};

export function RunnerScreen() {
  const { workoutId } = useParams();
  const state = useAppState();
  const navigate = useNavigate();

  const workout = workoutId ? workoutById(state, workoutId) : undefined;

  if (!workout) {
    return (
      <div className="runner">
        <p className="empty-note">Тренування не знайдено.</p>
        <Button variant="ghost" onClick={() => navigate('/')}>
          На головну
        </Button>
      </div>
    );
  }

  return <Runner key={workout.id} workout={workout} />;
}

function Runner({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const state = useAppState();
  const { settings } = state;
  const {
    view,
    exercise,
    completeSet,
    beginWork,
    addRest,
    skipExercise,
    undoSet,
    togglePause,
    finishNow,
    clearRun,
    saveSession,
  } = useWorkoutRunner(workout);

  const run = view.run;
  const phase: RunPhase = run?.phase ?? 'prep';

  const cue = useAudioCue(settings.sound);
  const vibrate = useVibrate(settings.vibration);
  useWakeLock(settings.keepAwake && phase !== 'done' && Boolean(run));

  const [reps, setReps] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [summary, setSummary] = useState<Session | null>(null);

  const setKey = `${view.exerciseIndex}-${view.setIndex}`;
  const lastWeight = run?.lastWeight;

  // Pre-fill the inputs whenever a new set comes up.
  useEffect(() => {
    if (!exercise) return;
    setReps(exercise.repsMax);
    setWeightKg(lastWeight?.[exercise.id] ?? exercise.weightKg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setKey, exercise?.id]);

  // Countdown phases roll over on their own.
  useEffect(() => {
    if (!run || view.paused) return;
    if (view.phaseRemainingSec > 0) return;
    if (phase === 'prep') beginWork();
    else if (phase === 'rest' && settings.autoAdvance) beginWork();
  }, [run, phase, view.paused, view.phaseRemainingSec, settings.autoAdvance, beginWork]);

  // Beep down the last three seconds of a countdown.
  const lastTickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!run || view.paused || (phase !== 'prep' && phase !== 'rest')) {
      lastTickRef.current = null;
      return;
    }
    const second = Math.ceil(view.phaseRemainingSec);
    if (second > 0 && second <= 3 && lastTickRef.current !== second) {
      lastTickRef.current = second;
      cue('tick');
      vibrate(40);
    }
  }, [run, phase, view.paused, view.phaseRemainingSec, cue, vibrate]);

  // One cue per phase change.
  const prevPhaseRef = useRef<RunPhase | null>(null);
  useEffect(() => {
    if (!run) return;
    if (prevPhaseRef.current === phase) return;
    if (prevPhaseRef.current !== null) {
      if (phase === 'work') {
        cue('go');
        vibrate([60, 40, 60]);
      } else if (phase === 'done') {
        cue('finish');
        vibrate([80, 60, 80, 60, 160]);
      }
    }
    prevPhaseRef.current = phase;
  }, [run, phase, cue, vibrate]);

  // Persist the result as soon as the workout ends.
  useEffect(() => {
    if (phase !== 'done' || !run || summary) return;
    const saved = saveSession();
    if (saved) setSummary(saved);
  }, [phase, run, summary, saveSession]);

  const volume = useMemo(
    () =>
      (run?.logs ?? []).reduce(
        (total, log) => total + log.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0),
        0,
      ),
    [run],
  );

  if (view.conflict) {
    const other = view.conflict;
    const otherWorkout = workoutById(state, other.workoutId);
    return (
      <div className="runner runner--centered">
        <Icon name="clock" size={34} />
        <h2 className="runner__conflict-title">Інше тренування ще триває</h2>
        <p className="muted runner__conflict-text">
          Тренування №{otherWorkout?.index ?? ''} ({otherWorkout?.focus ?? '—'}) ще не завершене.
          Що робимо?
        </p>
        <div className="runner__conflict-actions">
          <Button variant="ghost" block onClick={() => navigate(`/run/${other.workoutId}`)}>
            Повернутись до нього
          </Button>
          <Button
            variant="accent"
            block
            onClick={() => dispatch({ type: 'run/set', run: null })}
          >
            Почати це заново
          </Button>
        </div>
      </div>
    );
  }

  if (!run || !exercise) {
    return (
      <div className="runner runner--centered">
        <p className="muted">Готуємо тренування…</p>
      </div>
    );
  }

  if (phase === 'done') {
    const result = summary;
    return (
      <div className="runner">
        <div className="runner__summary">
          <span className="runner__medal">
            <Icon name="trophy" size={38} />
          </span>
          <h2 className="runner__summary-title">Тренування завершено</h2>
          <p className="muted">
            №{workout.index} · {workout.focus}
          </p>

          <div className="summary-grid">
            <SummaryStat value={formatDuration(run.workSec + run.restSec)} label="загалом" />
            <SummaryStat
              value={`${view.completedSets}/${view.plannedSets}`}
              label="підходів"
            />
            <SummaryStat value={formatDuration(run.workSec)} label="під навантаженням" />
            <SummaryStat
              value={`${Math.round(volume).toLocaleString('uk-UA')} кг`}
              label="загальний обсяг"
            />
          </div>

          <ul className="summary-list">
            {run.logs.map((log) => (
              <li key={log.exerciseId} className="summary-item">
                <span className="summary-item__name">{log.name}</span>
                <span className="summary-item__sets num">
                  {log.sets
                    .map((set) => `${set.reps}${set.weightKg > 0 ? `×${set.weightKg}` : ''}`)
                    .join(' · ')}
                </span>
              </li>
            ))}
            {run.logs.length === 0 && (
              <li className="empty-note">Жодного підходу не зафіксовано.</li>
            )}
          </ul>

          {result && !result.completed && (
            <p className="dim runner__summary-note">
              Частина підходів пропущена — зарахуємо тренування як незавершене.
            </p>
          )}

          <div className="runner__summary-actions">
            <Button
              variant="primary"
              block
              onClick={() => {
                clearRun();
                navigate('/', { replace: true });
              }}
            >
              Готово
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isRest = phase === 'rest';
  const isPrep = phase === 'prep';
  const timeText = isPrep || isRest
    ? formatClock(view.phaseRemainingSec)
    : formatClock(view.phaseElapsedSec);

  return (
    <div className={`runner runner--${phase}`}>
      <header className="runner__top">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setConfirmQuit(true)}
          aria-label="Завершити тренування"
        >
          <Icon name="close" size={22} />
        </button>
        <div className="runner__top-center">
          <p className="runner__top-title">
            Вправа {view.exerciseIndex + 1}/{workout.exercises.length}
          </p>
          <p className="runner__top-time num dim">{formatClock(view.totalElapsedSec)}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={togglePause}
          aria-label={view.paused ? 'Продовжити' : 'Пауза'}
        >
          <Icon name={view.paused ? 'play' : 'pause'} size={22} />
        </button>
      </header>

      <div className="runner__progress">
        <ProgressBar
          ratio={view.plannedSets === 0 ? 0 : view.completedSets / view.plannedSets}
          color="var(--accent)"
          height={4}
        />
        <p className="runner__progress-label dim num">
          {view.completedSets}/{view.plannedSets} підходів
        </p>
      </div>

      <div className="runner__ring">
        <RingTimer ratio={view.phaseRatio} color={PHASE_COLOR[phase]} size={236} stroke={13}>
          <p className="runner__phase" style={{ color: PHASE_COLOR[phase] }}>
            {view.paused ? 'Пауза' : PHASE_LABEL[phase]}
          </p>
          <p className="runner__time num">{timeText}</p>
          {!isPrep && (
            <p className="runner__set dim">
              Підхід {view.setIndex + 1}/{exercise.sets}
            </p>
          )}
        </RingTimer>
      </div>

      <div className="runner__exercise">
        <p className="runner__exercise-kicker dim">{isRest ? 'Далі' : 'Зараз'}</p>
        <h2 className="runner__exercise-name">{exercise.name}</h2>
        <p className="muted">
          ціль {exercise.repsMin}-{exercise.repsMax} повторень
          {exercise.hint ? ` · ${exercise.hint.toLowerCase()}` : ''}
        </p>
      </div>

      {phase === 'work' && (
        <>
          <div className="runner__inputs">
            <Stepper
              label="Повторення"
              value={reps}
              min={0}
              max={100}
              onChange={setReps}
            />
            <Stepper
              label="Вага"
              value={weightKg}
              step={2.5}
              min={0}
              max={400}
              suffix="кг"
              onChange={setWeightKg}
            />
          </div>
          <div className="runner__actions">
            <Button variant="primary" block onClick={() => completeSet(reps, weightKg)}>
              <Icon name="check" size={18} />
              Підхід виконано
            </Button>
            <div className="runner__actions-row">
              <Button variant="ghost" onClick={undoSet} disabled={view.completedSets === 0}>
                Скасувати підхід
              </Button>
              <Button variant="ghost" onClick={skipExercise}>
                <Icon name="skip" size={16} />
                Наступна вправа
              </Button>
            </div>
          </div>
        </>
      )}

      {isRest && (
        <div className="runner__actions">
          <Button variant="accent" block onClick={beginWork}>
            <Icon name="play" size={18} />
            {view.phaseRemainingSec <= 0 ? 'Почати підхід' : 'Пропустити відпочинок'}
          </Button>
          <div className="runner__actions-row">
            <Button variant="ghost" onClick={() => addRest(15)}>
              +15 секунд
            </Button>
            <Button variant="ghost" onClick={undoSet}>
              Скасувати підхід
            </Button>
          </div>
        </div>
      )}

      {isPrep && (
        <div className="runner__actions">
          <Button variant="accent" block onClick={beginWork}>
            <Icon name="play" size={18} />
            Почати зараз
          </Button>
        </div>
      )}

      {confirmQuit && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true">
          <div className="sheet">
            <h3 className="sheet__title">Завершити тренування?</h3>
            <p className="muted sheet__text">
              Зафіксовано {view.completedSets} із {view.plannedSets} підходів.
            </p>
            <Button variant="primary" block onClick={() => { setConfirmQuit(false); finishNow(); }}>
              Завершити і зберегти
            </Button>
            <Button
              variant="danger"
              block
              onClick={() => {
                clearRun();
                navigate('/', { replace: true });
              }}
            >
              Вийти без збереження
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmQuit(false)}>
              Продовжити тренування
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="summary-stat">
      <span className="summary-stat__value num">{value}</span>
      <span className="summary-stat__label dim">{label}</span>
    </div>
  );
}
