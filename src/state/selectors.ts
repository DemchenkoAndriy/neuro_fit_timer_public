import type { AppState, Goal, NutritionDay, Session, Workout } from '../types';
import { MEALS_PER_DAY } from '../data/program';
import { emptyNutritionDay, workoutDate } from './initialState';
import { addDays, daysBetween, fromISODate, isSameDay, startOfWeek, toISODate } from '../utils/date';

export interface Progress {
  done: number;
  total: number;
  /** 0..1 */
  ratio: number;
}

function progress(done: number, total: number): Progress {
  return { done, total, ratio: total === 0 ? 0 : Math.min(1, done / total) };
}

export function programStartDate(state: AppState): Date {
  return fromISODate(state.program.startDate);
}

export function programDays(state: AppState): number {
  return state.program.weeks * 7;
}

/** "2/16" on the home screen. */
export function trainingProgress(state: AppState): Progress {
  const done = state.sessions.filter((session) => session.completed).length;
  return progress(done, state.program.workouts.length);
}

/** "21/140" on the home screen — every meal slot of the whole program. */
export function nutritionProgress(state: AppState): Progress {
  const done = Object.values(state.nutrition).reduce(
    (sum, day) => sum + day.meals.filter(Boolean).length,
    0,
  );
  return progress(done, programDays(state) * MEALS_PER_DAY);
}

export function goalPercent(goal: Goal): number {
  if (goal.targetValue === 0) return 0;
  return Math.round((goal.currentValue / goal.targetValue) * 100);
}

/** Share of the distance from the starting value to the target, 0..1. */
export function goalRatio(goal: Goal): number {
  const span = goal.targetValue - goal.startValue;
  if (span === 0) return 1;
  return Math.max(0, Math.min(1, (goal.currentValue - goal.startValue) / span));
}

export function sessionForWorkout(state: AppState, workoutId: string): Session | undefined {
  return state.sessions.find((session) => session.workoutId === workoutId);
}

export function isWorkoutDone(state: AppState, workoutId: string): boolean {
  return sessionForWorkout(state, workoutId)?.completed ?? false;
}

export function workoutById(state: AppState, workoutId: string): Workout | undefined {
  return state.program.workouts.find((workout) => workout.id === workoutId);
}

export function dateForWorkout(state: AppState, workout: Workout): Date {
  return workoutDate(programStartDate(state), workout);
}

export function workoutsOnDate(state: AppState, date: Date): Workout[] {
  const start = programStartDate(state);
  return state.program.workouts.filter((workout) =>
    isSameDay(workoutDate(start, workout), date),
  );
}

/** Today's session if there is one, otherwise the next one still to be done. */
export function todaysWorkout(state: AppState, today = new Date()): Workout | undefined {
  const scheduled = workoutsOnDate(state, today).find(
    (workout) => !isWorkoutDone(state, workout.id),
  );
  if (scheduled) return scheduled;
  return state.program.workouts.find((workout) => !isWorkoutDone(state, workout.id));
}

export interface WeekDay {
  date: Date;
  iso: string;
  isToday: boolean;
  isPast: boolean;
  workouts: Workout[];
  hasWorkout: boolean;
  isDone: boolean;
}

/** The seven days of the week containing `today`, for the calendar strip. */
export function weekDays(state: AppState, today = new Date()): WeekDay[] {
  const monday = startOfWeek(today);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const dayWorkouts = workoutsOnDate(state, date);
    return {
      date,
      iso: toISODate(date),
      isToday: isSameDay(date, today),
      isPast: daysBetween(date, today) > 0,
      workouts: dayWorkouts,
      hasWorkout: dayWorkouts.length > 0,
      isDone:
        dayWorkouts.length > 0 &&
        dayWorkouts.every((workout) => isWorkoutDone(state, workout.id)),
    };
  });
}

export function nutritionDay(state: AppState, date: Date): NutritionDay {
  const iso = toISODate(date);
  return state.nutrition[iso] ?? emptyNutritionDay(iso);
}

/** Consecutive days up to today with at least one meal logged. */
export function nutritionStreak(state: AppState, today = new Date()): number {
  let streak = 0;
  for (let offset = 0; offset < 400; offset += 1) {
    const day = state.nutrition[toISODate(addDays(today, -offset))];
    const logged = day?.meals.some(Boolean) ?? false;
    if (!logged) {
      // Today still being empty shouldn't break yesterday's streak.
      if (offset === 0) continue;
      break;
    }
    streak += 1;
  }
  return streak;
}

/** Total kg lifted in a session (weight × reps over every logged set). */
export function sessionVolume(session: Session): number {
  return session.logs.reduce(
    (total, log) =>
      total + log.sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
    0,
  );
}

export function totalVolume(state: AppState): number {
  return state.sessions.reduce((sum, session) => sum + sessionVolume(session), 0);
}

export function totalTrainingSeconds(state: AppState): number {
  return state.sessions.reduce((sum, session) => sum + session.totalSec, 0);
}

/** Program week (1-based) that `date` falls into; clamped to the program length. */
export function currentWeek(state: AppState, date = new Date()): number {
  const offset = daysBetween(programStartDate(state), date);
  return Math.max(1, Math.min(state.program.weeks, Math.floor(offset / 7) + 1));
}
