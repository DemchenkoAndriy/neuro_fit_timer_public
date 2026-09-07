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
import { NUMBER_WORDS, useSpeech } from '../hooks/useSpeech';
import { useVibrate } from '../hooks/useVibrate';
import { useWakeLock } from '../hooks/useWakeLock';
import { formatClock, formatDuration } from '../utils/date';
import type { RunPhase, Session, SoundMode, Workout } from '../types';

const PHASE_COLOR: Record<RunPhase, string> = {
  prep: 'var(--accent)',
  warmup: 'var(--warmup)',
  work: 'var(--success)',
  rest: 'var(--info)',
  done: 'var(--success)',
};

const PHASE_LABEL: Record<RunPhase, string> = {
  prep: 'Приготуйся',
  warmup: 'Розминка',
  work: 'Робочий підхід',
  rest: 'Відпочинок',
  done: 'Готово',
};

const SOUND_ORDER: SoundMode[] = ['beeps', 'countdown', 'off'];
const SOUND_LABEL: Record<SoundMode, string> = {
  beeps: 'Варіант 1 · сигнали',
  countdown: 'Варіант 2 · відлік',
  off: 'Без звуку',
};

export function RunnerScreen() {
  const { workoutId } = useParams();
  const state = useAppState();
  const navigate = useNavigate();

  const workout = workoutId ? workoutById(state, workoutId) : undefined;

  if (!workout) {
    return (
      <div className="runner runner--centered">
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
  const { soundMode, tempo } = settings;

  const {
    view,
    exercise,
    completeSet,
    advance,
    addRest,
    setRestOverride,
    skipExercise,
    undoSet,
    togglePause,
    finishNow,
    clearRun,
    saveSession,
  } = useWorkoutRunner(workout);

  const run = view.run;
  const phase: RunPhase = run?.phase ?? 'prep';

  const soundOn = soundMode !== 'off';
  const cue = useAudioCue(soundOn);
  const speak = useSpeech(soundMode === 'countdown');
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
    if (phase === 'prep') advance();
    else if (phase === 'rest' && settings.autoAdvance) advance();
  }, [run, phase, view.paused, view.phaseRemainingSec, settings.autoAdvance, advance]);

  // Announce the countdown: signals at 10 s / 5 s, or a spoken 10 → 0.
  const announcedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!run || view.paused || (phase !== 'prep' && phase !== 'rest')) {
      announcedRef.current = null;
      return;
    }
    const second = Math.ceil(view.phaseRemainingSec);
    if (announcedRef.current === second || !soundOn) return;

    if (second === 0) {
      announcedRef.current = 0;
      cue('go');
      vibrate([60, 40, 60]);
      return;
    }
    if (soundMode === 'beeps' && (second === 10 || second === 5)) {
      announcedRef.current = second;
      cue('tick');
      vibrate(40);
      return;
    }
    if (soundMode === 'countdown' && second <= 10) {
      announcedRef.current = second;
      // No usable voice on this device → fall back to a plain beep.
      if (!speak(NUMBER_WORDS[second])) cue('tick');
      vibrate(30);
    }
  }, [run, phase, view.paused, view.phaseRemainingSec, soundMode, soundOn, cue, speak, vibrate]);

  // Tempo metronome: a click every eccentric second, a higher tone on the lift.
  const beatRef = useRef<number | null>(null);
  useEffect(() => {
    if (!run || view.paused || phase !== 'work' || !tempo.enabled) {
      beatRef.current = null;
      return;
    }
    const beat = Math.floor(view.phaseElapsedSec);
    if (beatRef.current === beat) return;
    beatRef.current = beat;
    const isDown = beat % (tempo.downSec + tempo.upSec) < tempo.downSec;
    if (soundOn) cue(isDown ? 'tempoDown' : 'tempoUp');
    if (!isDown) vibrate(35);
  }, [run, phase, view.paused, view.phaseElapsedSec, tempo, soundOn, cue, vibrate]);

  // One cue per phase change: the start of a set, and the finish.
  const prevPhaseRef = useRef<RunPhase | null>(null);
  useEffect(() => {
    if (!run) return;
    if (prevPhaseRef.current === phase) return;
    const previous = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (previous === null) return;
    if (phase === 'work' && previous === 'warmup') {
      cue('go');
      vibrate([60, 40, 60]);
    } else if (phase === 'done') {
      cue('finish');
      vibrate([80, 60, 80, 60, 160]);
    }
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

  // Where we are inside the current 4/1 cycle.
  const tempoState = useMemo(() => {
    const cycle = tempo.downSec + tempo.upSec;
    const position = view.phaseElapsedSec % cycle;
    const isDown = position < tempo.downSec;
    return {
      isDown,
      label: isDown ? `Опускай ${Math.ceil(tempo.downSec - position)}` : 'Підйом!',
      ratio: isDown ? position / tempo.downSec : (position - tempo.downSec) / tempo.upSec,
      reps: Math.floor(view.phaseElapsedSec / cycle),
    };
  }, [view.phaseElapsedSec, tempo]);

  const cycleSound = () => {
    const next = SOUND_ORDER[(SOUND_ORDER.indexOf(soundMode) + 1) % SOUND_ORDER.length];
    dispatch({ type: 'settings/update', patch: { soundMode: next } });
  };

  const toggleTempo = () => {
    dispatch({
      type: 'settings/update',
      patch: { tempo: { ...tempo, enabled: !tempo.enabled } },
    });
  };

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
          <Button variant="accent" block onClick={() => dispatch({ type: 'run/set', run: null })}>
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
            <SummaryStat
              value={formatDuration(result?.totalSec ?? view.totalElapsedSec)}
              label="загалом"
            />
            <SummaryStat value={`${view.completedSets}/${view.plannedSets}`} label="підходів" />
            <SummaryStat value={formatDuration(run.workSec)} label="під навантаженням" />
            <SummaryStat value={formatDuration(run.warmupSec)} label="розминка" />
            <SummaryStat value={formatDuration(run.restSec)} label="відпочинок" />
            <SummaryStat
              value={`${Math.round(volume).toLocaleString('uk-UA')} кг`}
              label="загальний обсяг"
            />
          </div>

          <h3 className="summary-heading">Деталізація</h3>
          <ul className="breakdown">
            {run.logs.map((log) => {
              const position = workout.exercises.findIndex(
                (item) => item.id === log.exerciseId,
              );
              const total =
                log.warmupSec +
                log.sets.reduce((sum, set) => sum + set.workSec + set.restSec, 0);
              return (
                <li key={log.exerciseId} className="breakdown__item">
                  <div className="breakdown__head">
                    <span className="breakdown__index num">
                      {position >= 0 ? position + 1 : '—'}
                    </span>
                    <span className="breakdown__name">{log.name}</span>
                    <span className="breakdown__total num">{formatClock(total)}</span>
                  </div>

                  {log.warmupSec > 0 && (
                    <div className="breakdown__row breakdown__row--warmup">
                      <span className="breakdown__label">Розминка</span>
                      <span />
                      <span className="breakdown__work num">{formatClock(log.warmupSec)}</span>
                      <span />
                    </div>
                  )}

                  {log.sets.map((set, index) => (
                    <div key={index} className="breakdown__row">
                      <span className="breakdown__label">Підхід {index + 1}</span>
                      <span className="breakdown__reps num">
                        {set.reps}
                        {set.weightKg > 0 ? ` × ${set.weightKg} кг` : ''}
                      </span>
                      <span className="breakdown__work num">{formatClock(set.workSec)}</span>
                      <span className="breakdown__rest num">
                        {set.restSec > 0 ? `відп. ${formatClock(set.restSec)}` : '—'}
                      </span>
                    </div>
                  ))}

                  {log.sets.length === 0 && (
                    <div className="breakdown__row">
                      <span className="breakdown__label dim">Підходів не зафіксовано</span>
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </li>
              );
            })}
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

  const isCountdown = phase === 'prep' || phase === 'rest';
  const timeText = isCountdown
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
          {/* The overall clock — runs from the very first second. */}
          <p className="runner__clock num" aria-label="Загальний час тренування">
            <Icon name="clock" size={14} />
            {formatClock(view.totalElapsedSec)}
          </p>
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

      <div className="runner__chips">
        <button
          type="button"
          className={`chip${soundOn ? ' chip--on' : ''}`}
          onClick={cycleSound}
          aria-label={`Звук: ${SOUND_LABEL[soundMode]}`}
        >
          {SOUND_LABEL[soundMode]}
        </button>
        <button
          type="button"
          className={`chip${tempo.enabled ? ' chip--on' : ''}`}
          onClick={toggleTempo}
          aria-pressed={tempo.enabled}
        >
          Темп {tempo.downSec}/{tempo.upSec}
          {tempo.enabled ? '' : ' · вимк'}
        </button>
      </div>

      <div className="runner__ring">
        <RingTimer ratio={view.phaseRatio} color={PHASE_COLOR[phase]} size={224} stroke={13}>
          <p className="runner__phase" style={{ color: PHASE_COLOR[phase] }}>
            {view.paused ? 'Пауза' : PHASE_LABEL[phase]}
          </p>
          <p className="runner__time num">{timeText}</p>
          {phase !== 'prep' && (
            <p className="runner__set dim">
              {phase === 'warmup'
                ? 'без обмеження часу'
                : `Підхід ${view.setIndex + 1}/${exercise.sets}`}
            </p>
          )}
        </RingTimer>
      </div>

      <div className="runner__exercise">
        <p className="runner__exercise-kicker dim">{phase === 'rest' ? 'Далі' : 'Зараз'}</p>
        <h2 className="runner__exercise-name">{exercise.name}</h2>
        <p className="muted">
          ціль {exercise.repsMin}-{exercise.repsMax} повторень
          {exercise.hint ? ` · ${exercise.hint.toLowerCase()}` : ''}
        </p>
      </div>

      {phase === 'work' && tempo.enabled && (
        <div className={`tempo${tempoState.isDown ? '' : ' tempo--up'}`}>
          <div className="tempo__head">
            <span className="tempo__label">{tempoState.label}</span>
            <span className="tempo__reps num">{tempoState.reps} повт.</span>
          </div>
          <ProgressBar
            ratio={tempoState.ratio}
            color={tempoState.isDown ? 'var(--info)' : 'var(--success)'}
            height={6}
          />
        </div>
      )}

      {phase === 'prep' && (
        <div className="runner__prep-settings">
          <Stepper
            label="Відпочинок між підходами"
            value={view.restSec}
            step={5}
            min={10}
            max={300}
            suffix="с"
            onChange={setRestOverride}
          />
          <p className="dim runner__prep-hint">
            Значення застосується до всіх вправ тренування.
          </p>
        </div>
      )}

      {phase === 'work' && (
        <>
          <div className="runner__inputs">
            <Stepper label="Повторення" value={reps} min={0} max={100} onChange={setReps} />
            <Stepper
              label="Вага"
              value={weightKg}
              step={1}
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

      {phase === 'warmup' && (
        <div className="runner__actions">
          <Button variant="accent" block onClick={advance}>
            <Icon name="play" size={18} />
            Розминку завершено
          </Button>
          <div className="runner__actions-row">
            <Button variant="ghost" onClick={skipExercise}>
              <Icon name="skip" size={16} />
              Наступна вправа
            </Button>
            <Button variant="ghost" onClick={undoSet} disabled={view.completedSets === 0}>
              Скасувати підхід
            </Button>
          </div>
        </div>
      )}

      {phase === 'rest' && (
        <div className="runner__actions">
          <Button variant="accent" block onClick={advance}>
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

      {phase === 'prep' && (
        <div className="runner__actions">
          <Button variant="accent" block onClick={advance}>
            <Icon name="play" size={18} />
            Почати розминку
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
            <Button
              variant="primary"
              block
              onClick={() => {
                setConfirmQuit(false);
                finishNow();
              }}
            >
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
