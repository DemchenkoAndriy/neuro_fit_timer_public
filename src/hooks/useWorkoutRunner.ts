import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ExerciseLog, RunState, Session, Workout } from '../types';
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
  /** Seconds left in a countdown phase; 0 for the count-up work phase. */
  phaseRemainingSec: number;
  /** 0..1 for the ring; work counts up against the rest length as a soft target. */
  phaseRatio: number;
  paused: boolean;
  totalElapsedSec: number;
  completedSets: number;
  plannedSets: number;
}

function newRun(workout: Workout, prepSec: number, now: number): RunState {
  return {
    workoutId: workout.id,
    startedAt: now,
    exerciseIndex: 0,
    setIndex: 0,
    phase: prepSec > 0 ? 'prep' : 'work',
    phaseStartedAt: now,
    phaseDurationSec: prepSec > 0 ? prepSec : 0,
    pausedAt: null,
    workSec: 0,
    restSec: 0,
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
        : // The work phase has no fixed length — fill the ring over the rest
          // interval so there is still a sense of pace.
          Math.min(1, phaseElapsedSec / Math.max(30, exercise?.restSec ?? 60));

    const live = run.phase === 'done' ? 0 : phaseElapsedSec;

    return {
      run,
      conflict,
      exerciseIndex: run.exerciseIndex,
      setIndex: run.setIndex,
      phaseElapsedSec,
      phaseRemainingSec,
      phaseRatio,
      paused: run.pausedAt != null,
      totalElapsedSec: run.workSec + run.restSec + live,
      completedSets: countLoggedSets(run.logs),
      plannedSets: total,
    };
  }, [run, conflict, now, workout, exercise]);

  /** Log the finished set and move on to rest, the next exercise, or the summary. */
  const completeSet = useCallback(
    (reps: number, weightKg: number) => {
      if (!run || !exercise) return;
      const at = Date.now();
      const elapsed = (run.pausedAt ?? at) - run.phaseStartedAt;

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
        logs,
        lastWeight: { ...run.lastWeight, [exercise.id]: weightKg },
        workSec: run.workSec + Math.max(0, elapsed / 1000),
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

      dispatch({
        type: 'run/set',
        run: {
          ...base,
          exerciseIndex: lastSet ? run.exerciseIndex + 1 : run.exerciseIndex,
          setIndex: lastSet ? 0 : run.setIndex + 1,
          phase: 'rest',
          phaseStartedAt: at,
          phaseDurationSec: exercise.restSec,
        },
      });
    },
    [dispatch, run, exercise, workout.exercises.length],
  );

  /** Leave the rest phase and begin the next set. */
  const beginWork = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    const elapsed = (run.pausedAt ?? at) - run.phaseStartedAt;
    dispatch({
      type: 'run/set',
      run: {
        ...run,
        restSec: run.phase === 'rest' ? run.restSec + Math.max(0, elapsed / 1000) : run.restSec,
        phase: 'work',
        phaseStartedAt: at,
        phaseDurationSec: 0,
        pausedAt: null,
      },
    });
  }, [dispatch, run]);

  const addRest = useCallback(
    (seconds: number) => {
      if (!run || run.phase !== 'rest') return;
      patch({ phaseDurationSec: Math.max(5, run.phaseDurationSec + seconds) });
    },
    [patch, run],
  );

  /** Drop the remaining sets of the current exercise and jump to the next one. */
  const skipExercise = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    if (run.exerciseIndex + 1 >= workout.exercises.length) {
      patch({ phase: 'done', phaseStartedAt: at, phaseDurationSec: 0, pausedAt: null });
      return;
    }
    patch({
      exerciseIndex: run.exerciseIndex + 1,
      setIndex: 0,
      phase: 'work',
      phaseStartedAt: at,
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run, workout.exercises.length]);

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
      patch({
        phaseStartedAt: run.phaseStartedAt + (Date.now() - run.pausedAt),
        pausedAt: null,
      });
    }
  }, [patch, run]);

  const finishNow = useCallback(() => {
    if (!run) return;
    const at = Date.now();
    const elapsed = (run.pausedAt ?? at) - run.phaseStartedAt;
    patch({
      phase: 'done',
      workSec: run.phase === 'work' ? run.workSec + Math.max(0, elapsed / 1000) : run.workSec,
      restSec: run.phase === 'rest' ? run.restSec + Math.max(0, elapsed / 1000) : run.restSec,
      phaseStartedAt: at,
      phaseDurationSec: 0,
      pausedAt: null,
    });
  }, [patch, run]);

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
      totalSec: Math.round(run.workSec + run.restSec),
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
    beginWork,
    addRest,
    skipExercise,
    undoSet,
    togglePause,
    finishNow,
    clearRun,
    saveSession,
  };
}
