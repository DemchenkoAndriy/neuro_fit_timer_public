import { useEffect, useMemo, useState } from 'react';
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
import { useVibrate } from '../hooks/useVibrate';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  CHALLENGE_LEAD_IN_SEC,
  CHALLENGE_LEAD_OUT_SEC,
  CHALLENGE_PRESETS,
} from '../data/challenges';
import { formatClock, formatDuration, formatTime } from '../utils/date';
import type { Session } from '../types';

export function ChallengeScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    view,
    start,
    beginRest,
    beginSet,
    setLastReps,
    togglePause,
    finish,
    clearRun,
    saveSession,
  } = useChallengeRunner();

  const [summary, setSummary] = useState<Session | null>(null);
  const run = view.run;
  const phase = run?.phase;

  const cue = useAudioCue(state.settings.soundMode !== 'off', state.settings.signalTone);
  const vibrate = useVibrate(state.settings.vibration);
  useWakeLock(state.settings.keepAwake && Boolean(run) && phase !== 'done');

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

  const isWork = phase === 'work';
  const spec = view.spec!;
  const lastSet = view.sets[view.sets.length - 1];
  const remaining = Math.max(0, spec.targetReps - view.totalReps);

  return (
    <div className={`runner runner--${isWork ? 'work' : 'rest'}`}>
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
            {spec.exerciseName} · підхід {view.sets.length + (isWork ? 1 : 0)}
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
        <RingTimer ratio={view.ratio} color={isWork ? 'var(--success)' : 'var(--info)'}>
          <p
            className="runner__phase"
            style={{ color: isWork ? 'var(--success)' : 'var(--info)' }}
          >
            {view.paused ? 'Пауза' : isWork ? 'Підхід' : 'Відпочинок'}
          </p>
          <p className="challenge__reps num">
            {view.totalReps}
            <span className="challenge__target">/{spec.targetReps}</span>
          </p>
          <p className="runner__set dim num">{formatClock(view.phaseElapsedSec)}</p>
        </RingTimer>
        <div className="runner__ring-side" />
      </div>

      {isWork ? (
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
            </p>
          </div>
          <div className="runner__actions">
            <Button
              variant="primary"
              block
              onClick={() => {
                beginSet();
                if (state.settings.soundMode !== 'off') cue('go');
                vibrate([60, 40, 60]);
              }}
            >
              <Icon name="play" size={18} />
              Наступний підхід
            </Button>
            <Button variant="ghost" block onClick={finish}>
              Завершити челендж
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface SetupProps {
  onStart: (spec: { exerciseName: string; targetReps: number }) => void;
  history: Session[];
}

function ChallengeSetup({ onStart, history }: SetupProps) {
  const [exerciseName, setExerciseName] = useState(CHALLENGE_PRESETS[0].exerciseName);
  const [targetReps, setTargetReps] = useState(CHALLENGE_PRESETS[0].targetReps);

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

        <p className="dim challenge__rules">
          Кількість повторень наперед не задається: робиш підхід, тиснеш «Підхід завершено» і
          вписуєш результат уже під час відпочинку. Відпочинок і завершення — вручну. З часу
          під навантаженням віднімається {CHALLENGE_LEAD_IN_SEC} с на вхід і{' '}
          {CHALLENGE_LEAD_OUT_SEC} с на вихід.
        </p>

        <Button
          variant="primary"
          block
          disabled={exerciseName.trim().length === 0}
          onClick={() => onStart({ exerciseName: exerciseName.trim(), targetReps })}
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
