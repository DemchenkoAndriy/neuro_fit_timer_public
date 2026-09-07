import type { AppState, ExerciseLog, NutritionDay, Session, Workout } from '../types';
import { createProgram, MEALS_PER_DAY, plannedSets } from '../data/program';
import { addDays, daysBetween, fromISODate, isoWeekday, toISODate } from '../utils/date';

export const STATE_VERSION = 2;

/** Date a program workout is scheduled on. */
export function workoutDate(programStart: Date, workout: Workout): Date {
  return addDays(programStart, (workout.week - 1) * 7 + (workout.weekday - 1));
}

/**
 * Demo history: every session of the program that was scheduled before today
 * counts as done, so a fresh install already looks lived-in.
 */
function seedSessions(workouts: Workout[], programStart: Date, today: Date): Session[] {
  return workouts
    .filter((workout) => daysBetween(workoutDate(programStart, workout), today) > 0)
    .map((workout) => {
      const date = workoutDate(programStart, workout);
      const startedAt = new Date(date).setHours(18, 30, 0, 0);
      const workSec = workout.durationMin * 60 * 0.55;
      const restSec = workout.durationMin * 60 * 0.45;
      const logs: ExerciseLog[] = workout.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: Array.from({ length: exercise.sets }, () => ({
          reps: exercise.repsMax,
          weightKg: exercise.weightKg,
        })),
      }));
      const sets = plannedSets(workout);
      return {
        id: `seed-${workout.id}`,
        workoutId: workout.id,
        startedAt,
        finishedAt: startedAt + workout.durationMin * 60_000,
        workSec: Math.round(workSec),
        restSec: Math.round(restSec),
        warmupSec: workout.exercises.length * 45,
        totalSec: workout.durationMin * 60,
        plannedSets: sets,
        completedSets: sets,
        completed: true,
        logs,
      };
    });
}

/** Demo nutrition history: past days mostly ticked, today still open. */
function seedNutrition(programStart: Date, today: Date): Record<string, NutritionDay> {
  const nutrition: Record<string, NutritionDay> = {};
  const elapsed = daysBetween(programStart, today);
  for (let offset = 0; offset < elapsed; offset += 1) {
    const date = addDays(programStart, offset);
    // Weekends slip a little — 4 meals instead of 5.
    const done = isoWeekday(date) >= 6 ? 4 : 5;
    nutrition[toISODate(date)] = {
      date: toISODate(date),
      meals: Array.from({ length: MEALS_PER_DAY }, (_, i) => i < done),
      water: done === 5 ? 8 : 6,
    };
  }
  return nutrition;
}

export function createInitialState(now = new Date()): AppState {
  const program = createProgram(now);
  const programStart = fromISODate(program.startDate);
  return {
    version: STATE_VERSION,
    profile: { name: 'Андрій', heightCm: 178, weightKg: 60 },
    goals: [
      {
        id: 'goal-weight',
        title: 'Набрати масу',
        unit: 'кг',
        startValue: 58,
        currentValue: 60,
        targetValue: 70,
      },
      {
        id: 'goal-biceps',
        title: "Об'єм біцепса",
        unit: 'см',
        startValue: 32,
        currentValue: 34,
        targetValue: 38,
      },
    ],
    program,
    sessions: seedSessions(program.workouts, programStart, now),
    nutrition: seedNutrition(programStart, now),
    settings: {
      soundMode: 'beeps',
      vibration: true,
      autoAdvance: true,
      keepAwake: true,
      prepSec: 10,
      tempo: { enabled: false, downSec: 4, upSec: 1 },
    },
    run: null,
  };
}

export function emptyNutritionDay(date: string): NutritionDay {
  return { date, meals: Array.from({ length: MEALS_PER_DAY }, () => false), water: 0 };
}
