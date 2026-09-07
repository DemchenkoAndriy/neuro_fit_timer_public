import type { Exercise, Program, Workout } from '../types';
import { addDays, startOfWeek, toISODate } from '../utils/date';

interface WorkoutTemplate {
  focus: string;
  durationMin: number;
  /** ISO weekday the session is scheduled on. */
  weekday: number;
  exercises: Omit<Exercise, 'id'>[];
}

/**
 * A four-day split. The cycle repeats every week of the program, so
 * workout #3 of the program is the biceps day from the original mockup.
 */
const SPLIT: WorkoutTemplate[] = [
  {
    focus: 'Груди / Трицепс',
    durationMin: 50,
    weekday: 1,
    exercises: [
      { name: 'Жим штанги лежачи', sets: 4, repsMin: 8, repsMax: 10, restSec: 120, weightKg: 50 },
      { name: 'Жим гантелей на похилій лаві', sets: 4, repsMin: 10, repsMax: 12, restSec: 90, weightKg: 20 },
      { name: 'Розведення гантелей лежачи', sets: 3, repsMin: 12, repsMax: 15, restSec: 60, weightKg: 12 },
      { name: 'Французький жим', sets: 3, repsMin: 10, repsMax: 12, restSec: 60, weightKg: 25 },
      {
        name: 'Розгинання рук на блоці',
        sets: 3,
        repsMin: 15,
        repsMax: 20,
        restSec: 45,
        weightKg: 20,
        hint: 'Невелика вага, повна амплітуда',
      },
    ],
  },
  {
    focus: 'Спина',
    durationMin: 50,
    weekday: 2,
    exercises: [
      { name: 'Підтягування широким хватом', sets: 4, repsMin: 8, repsMax: 10, restSec: 120, weightKg: 0 },
      { name: 'Тяга штанги в нахилі', sets: 4, repsMin: 8, repsMax: 10, restSec: 120, weightKg: 45 },
      { name: 'Тяга верхнього блока до грудей', sets: 3, repsMin: 10, repsMax: 12, restSec: 90, weightKg: 45 },
      { name: 'Тяга гантелі однією рукою', sets: 3, repsMin: 10, repsMax: 12, restSec: 75, weightKg: 24 },
      { name: 'Гіперекстензія', sets: 3, repsMin: 15, repsMax: 20, restSec: 60, weightKg: 0 },
    ],
  },
  {
    focus: 'Біцепс',
    durationMin: 40,
    weekday: 4,
    exercises: [
      { name: 'Підйом гантель стоя', sets: 4, repsMin: 10, repsMax: 12, restSec: 90, weightKg: 14 },
      { name: 'Молотки', sets: 4, repsMin: 10, repsMax: 12, restSec: 90, weightKg: 14 },
      {
        name: 'Підйом гантелі з горизонтальними долонями',
        sets: 4,
        repsMin: 10,
        repsMax: 12,
        restSec: 75,
        weightKg: 12,
      },
      {
        name: 'Багатоповторний підйом на біцепс',
        sets: 4,
        repsMin: 20,
        repsMax: 25,
        restSec: 60,
        weightKg: 8,
        hint: 'Невелика вага',
      },
    ],
  },
  {
    focus: 'Ноги / Плечі',
    durationMin: 55,
    weekday: 6,
    exercises: [
      { name: 'Присідання зі штангою', sets: 4, repsMin: 8, repsMax: 10, restSec: 150, weightKg: 60 },
      { name: 'Жим ногами', sets: 4, repsMin: 10, repsMax: 12, restSec: 120, weightKg: 100 },
      { name: 'Румунська тяга', sets: 3, repsMin: 10, repsMax: 12, restSec: 90, weightKg: 50 },
      { name: 'Жим гантелей сидячи', sets: 4, repsMin: 10, repsMax: 12, restSec: 90, weightKg: 18 },
      { name: 'Махи гантелями в сторони', sets: 3, repsMin: 15, repsMax: 20, restSec: 45, weightKg: 8 },
      { name: 'Підйом на носки', sets: 3, repsMin: 20, repsMax: 20, restSec: 45, weightKg: 40 },
    ],
  },
];

export const PROGRAM_WEEKS = 4;
export const MEALS_PER_DAY = 5;
export const MEAL_NAMES = ['Сніданок', 'Перекус', 'Обід', 'Перекус', 'Вечеря'];
export const WATER_GOAL_GLASSES = 8;

function buildWorkouts(): Workout[] {
  const workouts: Workout[] = [];
  for (let week = 1; week <= PROGRAM_WEEKS; week += 1) {
    SPLIT.forEach((template, dayIndex) => {
      const index = (week - 1) * SPLIT.length + dayIndex + 1;
      workouts.push({
        id: `w${index}`,
        index,
        week,
        weekday: template.weekday,
        focus: template.focus,
        durationMin: template.durationMin,
        exercises: template.exercises.map((exercise, i) => ({
          ...exercise,
          id: `w${index}e${i + 1}`,
        })),
      });
    });
  }
  return workouts;
}

/**
 * The program starts on the Monday of the previous week, so a fresh install
 * already has a completed first week behind it instead of an empty screen.
 */
export function createProgram(today = new Date()): Program {
  return {
    id: 'program-mass-4w',
    name: 'Набір маси — 4 тижні',
    weeks: PROGRAM_WEEKS,
    daysPerWeek: SPLIT.length,
    mealsPerDay: MEALS_PER_DAY,
    startDate: toISODate(addDays(startOfWeek(today), -7)),
    workouts: buildWorkouts(),
  };
}

/** Total sets planned across a workout. */
export function plannedSets(workout: Workout): number {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
}
