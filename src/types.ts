/** A single exercise inside a workout template. */
export interface Exercise {
  id: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Rest between sets, in seconds. */
  restSec: number;
  /** Suggested starting weight in kg; 0 means bodyweight. */
  weightKg: number;
  hint?: string;
}

/** One training session template inside the program. */
export interface Workout {
  id: string;
  /** Position in the program, 1..N — shown as "Тренування №3". */
  index: number;
  /** 1-based week of the program. */
  week: number;
  /** ISO weekday: 1 = понеділок … 7 = неділя. */
  weekday: number;
  /** Muscle focus, e.g. "Біцепс". */
  focus: string;
  durationMin: number;
  exercises: Exercise[];
}

export interface Program {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  mealsPerDay: number;
  /** ISO date (YYYY-MM-DD) of the Monday the program starts on. */
  startDate: string;
  workouts: Workout[];
}

export interface SetLog {
  reps: number;
  weightKg: number;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  sets: SetLog[];
}

/** A finished (or abandoned) run of a workout. */
export interface Session {
  id: string;
  workoutId: string;
  /** Epoch ms. */
  startedAt: number;
  finishedAt: number;
  workSec: number;
  restSec: number;
  warmupSec: number;
  totalSec: number;
  plannedSets: number;
  completedSets: number;
  /** True when every planned set was logged. */
  completed: boolean;
  logs: ExerciseLog[];
}

export interface Goal {
  id: string;
  title: string;
  unit: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
}

export interface NutritionDay {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** One flag per meal slot of the day. */
  meals: boolean[];
  /** Glasses of water, 250 ml each. */
  water: number;
}

export interface Profile {
  name: string;
  heightCm: number;
  weightKg: number;
}

/**
 * How a countdown is announced:
 * - `beeps`     — a signal at 10 s, 5 s and zero (варіант 1);
 * - `countdown` — the last ten seconds are counted out loud (варіант 2);
 * - `off`       — silence.
 */
export type SoundMode = 'beeps' | 'countdown' | 'off';

/** Metronome for a set: N seconds down (eccentric), M seconds up. */
export interface TempoSettings {
  enabled: boolean;
  downSec: number;
  upSec: number;
}

export interface Settings {
  soundMode: SoundMode;
  vibration: boolean;
  /** Skip the rest countdown and jump straight to the next set. */
  autoAdvance: boolean;
  keepAwake: boolean;
  prepSec: number;
  tempo: TempoSettings;
}

export type RunPhase = 'prep' | 'warmup' | 'work' | 'rest' | 'done';

/** Live state of a workout in progress — persisted so a reload can resume it. */
export interface RunState {
  workoutId: string;
  startedAt: number;
  exerciseIndex: number;
  setIndex: number;
  phase: RunPhase;
  /** Epoch ms the current phase started at (shifted forward while paused). */
  phaseStartedAt: number;
  /** Countdown length in seconds; 0 means the phase counts up. */
  phaseDurationSec: number;
  /** Epoch ms of the pause, or null when running. */
  pausedAt: number | null;
  /** Total time spent paused, so the overall clock can exclude it. */
  pausedMs: number;
  workSec: number;
  restSec: number;
  warmupSec: number;
  /** Rest length chosen at the start, applied to every exercise; null = per exercise. */
  restOverrideSec: number | null;
  logs: ExerciseLog[];
  /** Last weight used per exercise, to pre-fill the next set. */
  lastWeight: Record<string, number>;
}

export interface AppState {
  version: number;
  profile: Profile;
  goals: Goal[];
  program: Program;
  sessions: Session[];
  /** Keyed by ISO date. */
  nutrition: Record<string, NutritionDay>;
  settings: Settings;
  run: RunState | null;
}
