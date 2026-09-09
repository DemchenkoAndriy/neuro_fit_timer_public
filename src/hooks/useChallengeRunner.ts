import { useCallback, useMemo } from 'react';
import type { ChallengeSpec, RunState, Session, SetLog } from '../types';
import { useAppState, useDispatch } from '../state/store';
import { creditedWorkSec } from '../data/challenges';
import { useNow } from './useNow';

const LOG_ID = 'challenge';

export interface ChallengeView {
  run: RunState | null;
  /** A program workout still in progress blocks the challenge. */
  conflict: RunState | null;
  spec: ChallengeSpec | null;
  sets: SetLog[];
  totalReps: number;
  /** 0..1 towards the target. */
  ratio: number;
  paused: boolean;
  phaseElapsedSec: number;
  /** Time of the current set that will actually be credited. */
  creditedSec: number;
  totalElapsedSec: number;
  workSec: number;
  restSec: number;
}

function newRun(spec: ChallengeSpec, now: number): RunState {
  return {
    workoutId: `challenge-${now}`,
    mode: 'challenge',
    challenge: spec,
    startedAt: now,
    exerciseIndex: 0,
    setIndex: 0,
    // No count-down anywhere: the athlete decides when a set and a rest end.
    phase: 'work',
    phaseStartedAt: now,
    phaseDurationSec: 0,
    pausedAt: null,
    pausedMs: 0,
    workSec: 0,
    restSec: 0,
    warmupSec: 0,
    cooldownSec: 0,
    cooldownEnabled: false,
    restOverrideSec: null,
    logs: [{ exerciseId: LOG_ID, name: spec.exerciseName, sets: [] }],
    lastWeight: {},
  };
}

export function useChallengeRunner() {
  const state = useAppState();
  const dispatch = useDispatch();

  const run = state.run?.mode === 'challenge' ? state.run : null;
  const conflict =
    state.run && state.run.mode !== 'challenge' && state.run.phase !== 'done'
      ? state.run
      : null;

  const paused = run?.pausedAt != null;
  const now = useNow(200, Boolean(run) && !paused && run?.phase !== 'done');

  const sets = run?.logs[0]?.sets ?? [];
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);

  const view: ChallengeView = useMemo(() => {
    const spec = run?.challenge ?? null;
    const target = spec?.targetReps ?? 0;
    if (!run) {
      return {
        run: null,
        conflict,
        spec: null,
        sets: [],
        totalReps: 0,
        ratio: 0,
        paused: false,
        phaseElapsedSec: 0,
        creditedSec: 0,
        totalElapsedSec: 0,
        workSec: 0,
        restSec: 0,
      };
    }
    const reference = run.pausedAt ?? now;
    const phaseElapsedSec = Math.max(0, (reference - run.phaseStartedAt) / 1000);
    return {
      run,
      conflict,
      spec,
      sets,
      totalReps,
      ratio: target > 0 ? Math.min(1, totalReps / target) : 0,
      paused: run.pausedAt != null,
      phaseElapsedSec,
      // What the current set is worth right now, tail deduction included, so
      // the number never drops when the set is committed.
      creditedSec: run.phase === 'work' ? creditedWorkSec(phaseElapsedSec) : 0,
      totalElapsedSec: Math.max(0, (reference - run.startedAt - run.pausedMs) / 1000),
      workSec: run.workSec,
      restSec: run.restSec,
    };
  }, [run, conflict, now, sets, totalReps]);

  const patch = useCallback(
    (next: Partial<RunState>) => {
      if (!run) return;
      dispatch({ type: 'run/set', run: { ...run, ...next } });
    },
    [dispatch, run],
  );

  const start = useCallback(
    (spec: ChallengeSpec) => {
      dispatch({ type: 'run/set', run: newRun(spec, Date.now()) });
    },
    [dispatch],
  );

  const elapsedOf = useCallback(
    (at: number) => (run ? Math.max(0, ((run.pausedAt ?? at) - run.phaseStartedAt) / 1000) : 0),
    [run],
  );

  /** End the set: log it with the previous rep count, to be corrected in rest. */
  const beginRest = useCallback(() => {
    if (!run || run.phase !== 'work') return;
    const at = Date.now();
    const credited = creditedWorkSec(elapsedOf(at));
    const previous = sets[sets.length - 1]?.reps ?? 0;
    const log = run.logs[0];

    patch({
      logs: [
        {
          ...log,
          sets: [...log.sets, { reps: previous, weightKg: 0, workSec: credited, restSec: 0 }],
        },
      ],
      workSec: run.workSec + credited,
      phase: 'rest',
      phaseStartedAt: at,
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run, sets, elapsedOf]);

  /** Rest is over — next set. */
  const beginSet = useCallback(() => {
    if (!run || run.phase !== 'rest') return;
    const at = Date.now();
    const rested = elapsedOf(at);
    const log = run.logs[0];
    const updated = [...log.sets];
    if (updated.length > 0) {
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, restSec: last.restSec + rested };
    }

    patch({
      logs: [{ ...log, sets: updated }],
      restSec: run.restSec + rested,
      setIndex: run.setIndex + 1,
      phase: 'work',
      phaseStartedAt: at,
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run, elapsedOf]);

  /** Correct the reps of the set just finished. */
  const setLastReps = useCallback(
    (reps: number) => {
      if (!run) return;
      const log = run.logs[0];
      if (log.sets.length === 0) return;
      const updated = [...log.sets];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        reps: Math.max(0, Math.min(999, Math.round(reps))),
      };
      patch({ logs: [{ ...log, sets: updated }] });
    },
    [patch, run],
  );

  const togglePause = useCallback(() => {
    if (!run) return;
    if (run.pausedAt == null) {
      patch({ pausedAt: Date.now() });
    } else {
      const pause = Date.now() - run.pausedAt;
      patch({
        phaseStartedAt: run.phaseStartedAt + pause,
        pausedMs: run.pausedMs + pause,
        pausedAt: null,
      });
    }
  }, [patch, run]);

  /** Finishing is always manual — from a set or from a rest. */
  const finish = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    const elapsed = elapsedOf(at);

    if (run.phase === 'work') {
      // Credit the set that is running and log it.
      const credited = creditedWorkSec(elapsed);
      const previous = sets[sets.length - 1]?.reps ?? 0;
      const log = run.logs[0];
      patch({
        logs: [
          {
            ...log,
            sets: [...log.sets, { reps: previous, weightKg: 0, workSec: credited, restSec: 0 }],
          },
        ],
        workSec: run.workSec + credited,
        phase: 'done',
        phaseStartedAt: at,
        pausedAt: null,
      });
      return;
    }

    patch({
      restSec: run.phase === 'rest' ? run.restSec + elapsed : run.restSec,
      phase: 'done',
      phaseStartedAt: at,
      pausedAt: null,
    });
  }, [patch, run, sets, elapsedOf]);

  const clearRun = useCallback(() => {
    dispatch({ type: 'run/set', run: null });
  }, [dispatch]);

  /** Store the challenge in the same history as every other workout. */
  const saveSession = useCallback(() => {
    if (!run || !run.challenge) return;
    const finishedAt = Date.now();
    const logs = run.logs.filter((log) => log.sets.length > 0);
    const reps = logs.reduce(
      (sum, log) => sum + log.sets.reduce((count, set) => count + set.reps, 0),
      0,
    );
    const session: Session = {
      id: `s-${run.workoutId}`,
      workoutId: run.workoutId,
      startedAt: run.startedAt,
      finishedAt,
      pausedSec: Math.round(run.pausedMs / 1000),
      workSec: Math.round(run.workSec),
      restSec: Math.round(run.restSec),
      warmupSec: 0,
      cooldownSec: 0,
      totalSec: Math.round((finishedAt - run.startedAt - run.pausedMs) / 1000),
      // A challenge has no set plan — the target is in reps.
      plannedSets: 0,
      completedSets: logs[0]?.sets.length ?? 0,
      completed: reps >= run.challenge.targetReps,
      logs,
      challenge: run.challenge,
    };
    dispatch({ type: 'session/finish', session });
    return session;
  }, [dispatch, run]);

  return {
    view,
    start,
    beginRest,
    beginSet,
    setLastReps,
    togglePause,
    finish,
    clearRun,
    saveSession,
  };
}
