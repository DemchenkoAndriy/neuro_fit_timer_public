import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Exercise, ExerciseLog, RunState, Session, Workout } from '../types';
import { useAppState, useDispatch } from '../state/store';
import { plannedSets } from '../data/program';
import { useNow } from './useNow';

export interface RunnerView {
  run: RunState | null;
  /** True while another workout is still in progress. */
  conflict: RunState | null;
  exerciseIndex: number;
  setIndex: number;
  /** Seconds elapsed inside the current phase. */
  phaseElapsedSec: number;
  /** Seconds left in a countdown phase; 0 for the phases that count up. */
  phaseRemainingSec: number;
  /** 0..1 for the ring; countdowns drain, open-ended phases fill. */
  phaseRatio: number;
  paused: boolean;
  /** Wall-clock time since the very start of the workout, minus pauses. */
  totalElapsedSec: number;
  completedSets: number;
  plannedSets: number;
  /** Rest length in force for the next break. */
  restSec: number;
}

/** Rest between sets: the value chosen at the start wins over the plan. */
export function restLengthFor(run: RunState | null, exercise?: Exercise): number {
  if (run?.restOverrideSec != null) return run.restOverrideSec;
  return exercise?.restSec ?? 60;
}

function newRun(workout: Workout, prepSec: number, now: number): RunState {
  return {
    workoutId: workout.id,
    startedAt: now,
    exerciseIndex: 0,
    setIndex: 0,
    // Every exercise opens with an open-ended warm-up.
    phase: prepSec > 0 ? 'prep' : 'warmup',
    phaseStartedAt: now,
    phaseDurationSec: prepSec > 0 ? prepSec : 0,
    pausedAt: null,
    pausedMs: 0,
    workSec: 0,
    restSec: 0,
    warmupSec: 0,
    restOverrideSec: null,
    logs: [],
    lastWeight: {},
  };
}

function countLoggedSets(logs: ExerciseLog[]): number {
  return logs.reduce((sum, log) => sum + log.sets.length, 0);
}

export function useWorkoutRunner(workout: Workout) {
  const state = useAppState();
  const dispatch = useDispatch();
  const { settings } = state;

  const run = state.run?.workoutId === workout.id ? state.run : null;
  const conflict =
    state.run && state.run.workoutId !== workout.id && state.run.phase !== 'done'
      ? state.run
      : null;

  const paused = run?.pausedAt != null;
  const now = useNow(200, Boolean(run) && !paused && run?.phase !== 'done');
  const createdRef = useRef(false);

  const start = useCallback(() => {
    dispatch({ type: 'run/set', run: newRun(workout, settings.prepSec, Date.now()) });
  }, [dispatch, workout, settings.prepSec]);

  // Create a run the first time the screen is opened for this workout.
  useEffect(() => {
    if (run || conflict || createdRef.current) return;
    createdRef.current = true;
    start();
  }, [run, conflict, start]);

  const patch = useCallback(
    (next: Partial<RunState>) => {
      if (!run) return;
      dispatch({ type: 'run/set', run: { ...run, ...next } });
    },
    [dispatch, run],
  );

  const exercise = run ? workout.exercises[run.exerciseIndex] : undefined;

  const view: RunnerView = useMemo(() => {
    const total = plannedSets(workout);
    if (!run) {
      return {
        run: null,
        conflict,
        exerciseIndex: 0,
        setIndex: 0,
        phaseElapsedSec: 0,
        phaseRemainingSec: 0,
        phaseRatio: 0,
        paused: false,
        totalElapsedSec: 0,
        completedSets: 0,
        plannedSets: total,
        restSec: restLengthFor(null, workout.exercises[0]),
      };
    }

    const reference = run.pausedAt ?? now;
    const phaseElapsedSec = Math.max(0, (reference - run.phaseStartedAt) / 1000);
    const phaseRemainingSec =
      run.phaseDurationSec > 0 ? Math.max(0, run.phaseDurationSec - phaseElapsedSec) : 0;
    const phaseRatio =
      run.phaseDurationSec > 0
        ? // Countdowns drain: the arc shows what is left.
          Math.max(0, phaseRemainingSec / run.phaseDurationSec)
        : // Open-ended phases have no target — fill over the rest interval so
          // there is still a sense of pace.
          Math.min(1, phaseElapsedSec / Math.max(30, restLengthFor(run, exercise)));

    return {
      run,
      conflict,
      exerciseIndex: run.exerciseIndex,
      setIndex: run.setIndex,
      phaseElapsedSec,
      phaseRemainingSec,
      phaseRatio,
      paused: run.pausedAt != null,
      // Counts from the very first second of the workout, pauses excluded.
      totalElapsedSec: Math.max(0, (reference - run.startedAt - run.pausedMs) / 1000),
      completedSets: countLoggedSets(run.logs),
      plannedSets: total,
      restSec: restLengthFor(run, exercise),
    };
  }, [run, conflict, now, workout, exercise]);

  /** Seconds spent in the current phase, ignoring time spent paused. */
  const phaseElapsed = useCallback(
    (at: number) => (run ? Math.max(0, ((run.pausedAt ?? at) - run.phaseStartedAt) / 1000) : 0),
    [run],
  );

  /** Add the finished phase to its bucket. */
  const bucketFor = useCallback(
    (at: number): Partial<RunState> => {
      if (!run) return {};
      const elapsed = phaseElapsed(at);
      if (run.phase === 'work') return { workSec: run.workSec + elapsed };
      if (run.phase === 'rest') return { restSec: run.restSec + elapsed };
      if (run.phase === 'warmup') return { warmupSec: run.warmupSec + elapsed };
      return {};
    },
    [run, phaseElapsed],
  );

  /** Log the finished set and move on to rest, the next warm-up, or the summary. */
  const completeSet = useCallback(
    (reps: number, weightKg: number) => {
      if (!run || !exercise) return;
      const at = Date.now();

      const logs = [...run.logs];
      const existing = logs.findIndex((log) => log.exerciseId === exercise.id);
      if (existing >= 0) {
        logs[existing] = {
          ...logs[existing],
          sets: [...logs[existing].sets, { reps, weightKg }],
        };
      } else {
        logs.push({ exerciseId: exercise.id, name: exercise.name, sets: [{ reps, weightKg }] });
      }

      const base: RunState = {
        ...run,
        ...bucketFor(at),
        logs,
        lastWeight: { ...run.lastWeight, [exercise.id]: weightKg },
        pausedAt: null,
      };

      const lastSet = run.setIndex + 1 >= exercise.sets;
      const lastExercise = run.exerciseIndex + 1 >= workout.exercises.length;

      if (lastSet && lastExercise) {
        dispatch({
          type: 'run/set',
          run: { ...base, phase: 'done', phaseStartedAt: at, phaseDurationSec: 0 },
        });
        return;
      }

      if (lastSet) {
        // Moving on: the next exercise opens with its own warm-up.
        dispatch({
          type: 'run/set',
          run: {
            ...base,
            exerciseIndex: run.exerciseIndex + 1,
            setIndex: 0,
            phase: 'warmup',
            phaseStartedAt: at,
            phaseDurationSec: 0,
          },
        });
        return;
      }

      dispatch({
        type: 'run/set',
        run: {
          ...base,
          setIndex: run.setIndex + 1,
          phase: 'rest',
          phaseStartedAt: at,
          phaseDurationSec: restLengthFor(run, exercise),
        },
      });
    },
    [dispatch, run, exercise, workout.exercises.length, bucketFor],
  );

  /**
   * Move to the next phase: prep → warm-up, warm-up → set, rest → set.
   * Used by the buttons and by the countdowns when they hit zero.
   */
  const advance = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    dispatch({
      type: 'run/set',
      run: {
        ...run,
        ...bucketFor(at),
        phase: run.phase === 'prep' ? 'warmup' : 'work',
        phaseStartedAt: at,
        phaseDurationSec: 0,
        pausedAt: null,
      },
    });
  }, [dispatch, run, bucketFor]);

  const addRest = useCallback(
    (seconds: number) => {
      if (!run || run.phase !== 'rest') return;
      patch({ phaseDurationSec: Math.max(5, run.phaseDurationSec + seconds) });
    },
    [patch, run],
  );

  /** Rest length for the whole workout, picked before the first set. */
  const setRestOverride = useCallback(
    (seconds: number) => {
      if (!run) return;
      patch({
        restOverrideSec: Math.max(10, Math.min(300, Math.round(seconds))),
        // Adjusting the dial restarts the prep countdown, so it can't run out
        // from under the athlete mid-tap.
        phaseStartedAt: run.phase === 'prep' ? Date.now() : run.phaseStartedAt,
      });
    },
    [patch, run],
  );

  /** Drop the remaining sets of the current exercise and warm up the next one. */
  const skipExercise = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    if (run.exerciseIndex + 1 >= workout.exercises.length) {
      patch({
        ...bucketFor(at),
        phase: 'done',
        phaseStartedAt: at,
        phaseDurationSec: 0,
        pausedAt: null,
      });
      return;
    }
    patch({
      ...bucketFor(at),
      exerciseIndex: run.exerciseIndex + 1,
      setIndex: 0,
      phase: 'warmup',
      phaseStartedAt: at,
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run, workout.exercises.length, bucketFor]);

  /** Undo the last logged set and redo it. */
  const undoSet = useCallback(() => {
    if (!run) return;
    const logs = [...run.logs];
    let index = logs.length - 1;
    while (index >= 0 && logs[index].sets.length === 0) index -= 1;
    if (index < 0) return;

    const target = logs[index];
    logs[index] = { ...target, sets: target.sets.slice(0, -1) };
    const exerciseIndex = workout.exercises.findIndex((item) => item.id === target.exerciseId);

    patch({
      logs: logs.filter((log) => log.sets.length > 0),
      exerciseIndex: exerciseIndex >= 0 ? exerciseIndex : run.exerciseIndex,
      setIndex: Math.max(0, target.sets.length - 1),
      phase: 'work',
      phaseStartedAt: Date.now(),
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run, workout.exercises]);

  const togglePause = useCallback(() => {
    if (!run) return;
    if (run.pausedAt == null) {
      patch({ pausedAt: Date.now() });
    } else {
      // Shift the phase start forward so the pause never counts as elapsed time.
      const pause = Date.now() - run.pausedAt;
      patch({
        phaseStartedAt: run.phaseStartedAt + pause,
        pausedMs: run.pausedMs + pause,
        pausedAt: null,
      });
    }
  }, [patch, run]);

  const finishNow = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    patch({
      ...bucketFor(at),
      phase: 'done',
      phaseStartedAt: at,
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run, bucketFor]);

  const clearRun = useCallback(() => {
    createdRef.current = true;
    dispatch({ type: 'run/set', run: null });
  }, [dispatch]);

  /** Persist the finished run as a session. Safe to call more than once. */
  const saveSession = useCallback(() => {
    if (!run) return;
    const completed = countLoggedSets(run.logs);
    const total = plannedSets(workout);
    const session: Session = {
      id: `s-${workout.id}-${run.startedAt}`,
      workoutId: workout.id,
      startedAt: run.startedAt,
      finishedAt: Date.now(),
      workSec: Math.round(run.workSec),
      restSec: Math.round(run.restSec),
      warmupSec: Math.round(run.warmupSec),
      totalSec: Math.round(run.workSec + run.restSec + run.warmupSec),
      plannedSets: total,
      completedSets: completed,
      completed: completed >= total,
      logs: run.logs,
    };
    dispatch({ type: 'session/finish', session });
    return session;
  }, [dispatch, run, workout]);

  return {
    view,
    exercise,
    start,
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
  };
}
