import type { ChallengeSpec } from '../types';

/**
 * Bodyweight sets start and end with dead time — getting to the bar, hanging,
 * dropping off — so this much is taken off every set's time under load.
 */
export const CHALLENGE_LEAD_IN_SEC = 5;
export const CHALLENGE_LEAD_OUT_SEC = 5;

/** Time that actually counts as work for a challenge set. */
export function creditedWorkSec(elapsedSec: number): number {
  return Math.max(0, elapsedSec - CHALLENGE_LEAD_IN_SEC - CHALLENGE_LEAD_OUT_SEC);
}

export const CHALLENGE_PRESETS: ChallengeSpec[] = [
  { exerciseName: 'Підтягування', targetReps: 50 },
  { exerciseName: 'Віджимання', targetReps: 100 },
  { exerciseName: 'Прес', targetReps: 100 },
  { exerciseName: 'Присідання', targetReps: 100 },
];
