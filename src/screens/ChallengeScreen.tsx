import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { RingTimer } from '../components/RingTimer';
import { Stepper } from '../components/Stepper';
import { useAppState, useDispatch } from '../state/store';
import { challengeSessions } from '../state/selectors';
import { useChallengeRunner } from '../hooks/useChallengeRunner';
import { useAudioCue } from '../hooks/useAudioCue';
import { NUMBER_WORDS, useSpeech } from '../hooks/useSpeech';
import { useVibrate } from '../hooks/useVibrate';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  CHALLENGE_LEAD_IN_SEC,
  CHALLENGE_LEAD_OUT_SEC,
  CHALLENGE_PRESETS,
} from '../data/challenges';
import { formatClock, formatDuration, formatTime } from '../utils/date';
import type { ChallengeSpec, Session } from '../types';

export function ChallengeScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    view,
    start,
    finishWarmup,
    beginRest,
    beginSet,
    addRest,
    setLastReps,
    togglePause,
    finish,
    clearRun,
    saveSession,
  } = useChallengeRunner();

  const [summary, setSummary] = useState<Session | null>(null);
  const run = view.run;
  const phase = run?.phase;

  const { soundMode, signalTone } = state.settings;
  const soundOn = soundMode !== 'off';
  const cue = useAudioCue(soundOn, signalTone);
  const speak = useSpeech(soundMode === 'countdown');
  const vibrate = useVibrate(state.settings.vibration);
  useWakeLock(state.settings.keepAwake && Boolean(run) && phase !== 'done');

  // Announce the rest countdown: 10 s / 5 s signals, or a spoken 10 → 0.
  const announcedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!run || view.paused || phase !== 'rest') {
      announcedRef.current = null;
      return;
    }
    const second = Math.ceil(view.restRemainingSec);
    if (announcedRef.current === second || !soundOn) return;
    if (second === 0) {
      announcedRef.current = 0;
      cue('go');
      vibrate([80, 60, 80]);
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
      if (!speak(NUMBER_WORDS[second])) cue('tick');
      vibrate(30);
    }
  }, [run, phase, view.paused, view.restRemainingSec, soundMode, soundOn, cue, speak, vibrate]);

  // Save as soon as the challenge is closed out.
  useEffect(() => {
    if (phase !== 'done' || !run || summary) return;
    const saved = saveSession();
    if (saved) setSummary(saved);
  }, [phase, run, summary, saveSession]);

  const history = useMemo(
    () => [...challengeSessions(state)].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5),
    [state],
  );

  if (view.conflict) {
    return (
      <div className="screen">
        <AppHeader title="Челендж" left={<BackButton to="/" />} />
        <div className="screen-body">
          <div className="conflict-card">
            <Icon name="clock" size={30} />
            <p className="muted">
              Спершу заверши тренування, яке вже триває — інакше його результат загубиться.
            </p>
            <Button
              variant="ghost"
              block
              onClick={() => navigate(`/run/${view.conflict?.workoutId}`)}
            >
              Повернутись до тренування
            </Button>
            <Button
              variant="danger"
              block
              onClick={() => dispatch({ type: 'run/set', run: null })}
            >
              Скинути його і почати челендж
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!run) {
    return <ChallengeSetup onStart={start} history={history} />;
  }

  if (phase === 'done') {
    return (
      <ChallengeSummary
        session={summary}
        view={view}
        onClose={() => {
          clearRun();
          setSummary(null);
          navigate('/', { replace: true });
        }}
      />
    );
  }

  const isWarmup = phase === 'warmup';
  const isWork = phase === 'work';
  const isRest = phase === 'rest';
  const spec = view.spec!;
  const lastSet = view.sets[view.sets.length - 1];
  const remaining = Math.max(0, spec.targetReps - view.totalReps);
  const restOver = isRest && view.restRemainingSec <= 0;
  // The last ten seconds get the loud treatment.
  const restUrgent = isRest && !restOver && view.restRemainingSec <= 10;
  // Reps and clock keep the same slots in every phase, so nothing jumps.
  const clockText = isRest
    ? restOver
      ? `+${formatClock(view.restOverSec)}`
      : formatClock(view.restRemainingSec)
    : formatClock(view.phaseElapsedSec);

  const phaseColor = isWarmup
    ? 'var(--warmup)'
    : isWork
      ? 'var(--success)'
      : restOver || restUrgent
        ? 'var(--accent)'
        : 'var(--info)';

  const rootClass = [
    'runner',
    `runner--${phase}`,
    restOver || restUrgent ? 'runner--rest-alert' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <header className="runner__top">
        <button
          type="button"
          className="icon-btn"
          onClick={finish}
          aria-label="Закрити і зберегти челендж"
        >
          <Icon name="close" size={22} />
        </button>
        <div className="runner__top-center">
          <p className="runner__top-title">
            {spec.exerciseName}
            {isWarmup ? ' · розминка' : ` · підхід ${view.sets.length + (isWork ? 1 : 0)}`}
          </p>
          <p className="runner__clock num">
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

      <div className="runner__ring">
        <div className="runner__ring-side" />
        <RingTimer
          // Rest drains its own countdown; the other phases show the goal.
          ratio={
            isRest && view.restTargetSec > 0
              ? view.restRemainingSec / view.restTargetSec
              : view.ratio
          }
          color={phaseColor}
          thickness={isRest ? 9 : 6}
          className={isRest ? 'ring--rest' : undefined}
        >
          <p className="runner__phase" style={{ color: phaseColor }}>
            {view.paused ? 'Пауза' : isWarmup ? 'Розминка' : isWork ? 'Підхід' : 'Відпочинок'}
          </p>
          <p className="challenge__line num">
            {view.totalReps}
            <span className="challenge__line-of">/{spec.targetReps}</span>
          </p>
          <p
            className={`challenge__line num${
              restUrgent ? ' challenge__line--urgent' : ''
            }`}
            style={{ color: restOver || restUrgent ? 'var(--accent)' : 'var(--text)' }}
          >
            {clockText}
          </p>
        </RingTimer>
        <div className="runner__ring-side" />
      </div>

      {isWarmup ? (
        <>
          <div className="challenge__credit">
            <span className="dim">Розігрійся перед першим підходом</span>
            <span className="dim challenge__credit-hint">
              {spec.exerciseName} · ціль {spec.targetReps} повторень
            </span>
          </div>
          <div className="runner__actions">
            <Button variant="accent" block onClick={finishWarmup}>
              <Icon name="play" size={18} />
              Розминку завершено
            </Button>
            <Button variant="ghost" block onClick={finish}>
              Завершити челендж
            </Button>
          </div>
        </>
      ) : isWork ? (
        <>
          <div className="challenge__credit">
            <span className="dim">У залік</span>
            <span className="num challenge__credit-value">{formatClock(view.creditedSec)}</span>
            <span className="dim challenge__credit-hint">
              −{CHALLENGE_LEAD_IN_SEC} с на вхід, −{CHALLENGE_LEAD_OUT_SEC} с на вихід
            </span>
          </div>
          <div className="runner__actions">
            <Button variant="accent" block onClick={beginRest}>
              <Icon name="pause" size={18} />
              Підхід завершено
            </Button>
            <Button variant="ghost" block onClick={finish}>
              Завершити челендж
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="challenge__correct">
            <Stepper
              label={`Підхід ${view.sets.length} — скільки вийшло`}
              value={lastSet?.reps ?? 0}
              min={0}
              max={999}
              onChange={setLastReps}
            />
            <p className="dim challenge__remaining">
              {remaining > 0
                ? `Залишилось ${remaining} до цілі ${spec.targetReps}`
                : `Ціль ${spec.targetReps} досягнута — можна ще`}
              {' · '}
              відпочинок {formatClock(view.restTargetSec)}
            </p>
          </div>
          <div className="runner__actions">
            <Button
              variant="primary"
              block
              onClick={() => {
                beginSet();
                if (soundOn) cue('go');
                vibrate([60, 40, 60]);
              }}
            >
              <Icon name="play" size={18} />
              Наступний підхід
            </Button>
            <div className="runner__actions-row runner__actions-row--three">
              <Button variant="ghost" onClick={() => addRest(-15)}>
                −15 с
              </Button>
              <Button variant="ghost" onClick={() => addRest(15)}>
                +15 с
              </Button>
              <Button variant="ghost" onClick={finish}>
                Завершити
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SetupProps {
  onStart: (spec: ChallengeSpec) => void;
  history: Session[];
}

function ChallengeSetup({ onStart, history }: SetupProps) {
  const [exerciseName, setExerciseName] = useState(CHALLENGE_PRESETS[0].exerciseName);
  const [targetReps, setTargetReps] = useState(CHALLENGE_PRESETS[0].targetReps);
  const [restSec, setRestSec] = useState(CHALLENGE_PRESETS[0].restSec);

  return (
    <div className="screen">
      <AppHeader
        title="Челендж"
        subtitle="Скільки повторень зробиш сьогодні"
        left={<BackButton to="/" />}
      />

      <div className="screen-body">
        <p className="section-label">Вправа</p>
        <div className="challenge__presets">
          {CHALLENGE_PRESETS.map((preset) => (
            <button
              key={preset.exerciseName}
              type="button"
              className={`challenge__preset${
                preset.exerciseName === exerciseName ? ' challenge__preset--active' : ''
              }`}
              onClick={() => {
                setExerciseName(preset.exerciseName);
                setTargetReps(preset.targetReps);
                setRestSec(preset.restSec);
              }}
            >
              {preset.exerciseName}
            </button>
          ))}
        </div>

        <label className="challenge__name-field">
          <span className="section-label">Або своя назва</span>
          <input
            type="text"
            className="challenge__input"
            value={exerciseName}
            maxLength={40}
            onChange={(event) => setExerciseName(event.target.value)}
          />
        </label>

        <div className="challenge__target-card">
          <Stepper
            label="Ціль на сьогодні"
            value={targetReps}
            step={5}
            min={1}
            max={999}
            suffix="повт."
            onChange={setTargetReps}
          />
          <div className="challenge__quick">
            {[25, 50, 100, 200].map((value) => (
              <button
                key={value}
                type="button"
                className={`chip${value === targetReps ? ' chip--on' : ''}`}
                onClick={() => setTargetReps(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="challenge__target-card">
          <Stepper
            label="Відпочинок між підходами"
            value={restSec}
            step={15}
            min={10}
            max={600}
            suffix="с"
            onChange={setRestSec}
          />
          <p className="dim challenge__remaining">
            Таймер відлічує цей час, але наступний підхід завжди стартуєш ти.
          </p>
        </div>

        <p className="dim challenge__rules">
          Кількість повторень наперед не задається: робиш підхід, тиснеш «Підхід завершено» і
          вписуєш результат уже під час відпочинку. Челендж починається з розминки, а
          відпочинок і завершення — вручну. З часу під навантаженням віднімається{' '}
          {CHALLENGE_LEAD_IN_SEC} с на вхід і {CHALLENGE_LEAD_OUT_SEC} с на вихід.
        </p>

        <Button
          variant="primary"
          block
          disabled={exerciseName.trim().length === 0}
          onClick={() => onStart({ exerciseName: exerciseName.trim(), targetReps, restSec })}
        >
          <Icon name="play" size={18} />
          Почати челендж
        </Button>

        {history.length > 0 && (
          <>
            <p className="section-label section-gap">Останні челенджі</p>
            <ul className="history-list">
              {history.map((session) => {
                const reps = session.logs.reduce(
                  (sum, log) => sum + log.sets.reduce((count, set) => count + set.reps, 0),
                  0,
                );
                return (
                  <li key={session.id} className="history-item">
                    <div>
                      <p className="history-item__title">
                        {session.challenge?.exerciseName}
                        {session.completed && (
                          <span className="challenge__badge">ціль взято</span>
                        )}
                      </p>
                      <p className="history-item__meta dim">
                        {new Date(session.startedAt).toLocaleDateString('uk-UA')} ·{' '}
                        <span className="num">
                          {formatTime(session.startedAt)}–{formatTime(session.finishedAt)}
                        </span>{' '}
                        · {session.completedSets} підходів
                      </p>
                    </div>
                    <span className="history-item__volume num">
                      {reps}/{session.challenge?.targetReps}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

interface SummaryProps {
  session: Session | null;
  view: ReturnType<typeof useChallengeRunner>['view'];
  onClose: () => void;
}

function ChallengeSummary({ session, view, onClose }: SummaryProps) {
  const spec = view.spec;
  const hit = view.totalReps >= (spec?.targetReps ?? 0);

  return (
    <div className="runner">
      <div className="runner__summary">
        <span className="runner__medal">
          <Icon name={hit ? 'trophy' : 'flame'} size={38} />
        </span>
        <h2 className="runner__summary-title">
          {hit ? 'Ціль взято!' : 'Челендж завершено'}
        </h2>
        <p className="muted">
          {spec?.exerciseName} · ціль {spec?.targetReps}
        </p>

        <p className="challenge__result num">
          {view.totalReps}
          <span className="challenge__target">/{spec?.targetReps}</span>
        </p>

        {session && (
          <p className="summary-clock num">
            <span className="summary-clock__mark">{formatTime(session.startedAt)}</span>
            <span className="summary-clock__arrow">→</span>
            <span className="summary-clock__mark">{formatTime(session.finishedAt)}</span>
          </p>
        )}

        <div className="summary-grid">
          <SummaryStat value={`${view.sets.length}`} label="підходів" />
          <SummaryStat
            value={
              view.sets.length > 0
                ? (view.totalReps / view.sets.length).toFixed(1).replace('.', ',')
                : '0'
            }
            label="в середньому"
          />
          <SummaryStat value={formatDuration(view.workSec)} label="під навантаженням" />
          <SummaryStat value={formatDuration(view.restSec)} label="відпочинок" />
          <SummaryStat value={formatDuration(view.warmupSec)} label="розминка" />
          {session && (
            <SummaryStat value={formatDuration(session.totalSec)} label="чистий час" />
          )}
        </div>

        <h3 className="summary-heading">Деталізація</h3>
        <ul className="breakdown">
          {view.sets.map((set, index) => (
            <li key={index} className="breakdown__item">
              <div className="breakdown__row">
                <span className="breakdown__label">Підхід {index + 1}</span>
                <span className="breakdown__reps num">{set.reps} повт.</span>
                <span className="breakdown__work num">{formatClock(set.workSec)}</span>
                <span className="breakdown__rest num">
                  {set.restSec > 0 ? `відп. ${formatClock(set.restSec)}` : '—'}
                </span>
              </div>
            </li>
          ))}
          {view.sets.length === 0 && (
            <li className="empty-note">Жодного підходу не зафіксовано.</li>
          )}
        </ul>

        <div className="runner__summary-actions">
          <Button variant="primary" block onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
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
