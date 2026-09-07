import type { AppState, Goal, Profile, RunState, Session, Settings } from '../types';
import { createInitialState, emptyNutritionDay } from './initialState';

export type Action =
  | { type: 'profile/update'; patch: Partial<Profile> }
  | { type: 'goal/update'; id: string; patch: Partial<Omit<Goal, 'id'>> }
  | { type: 'goal/add'; goal: Goal }
  | { type: 'goal/remove'; id: string }
  | { type: 'nutrition/toggleMeal'; date: string; index: number }
  | { type: 'nutrition/setWater'; date: string; glasses: number }
  | { type: 'session/finish'; session: Session }
  | { type: 'session/remove'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'run/set'; run: RunState | null }
  | { type: 'app/reset' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'profile/update':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case 'goal/update':
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.id ? { ...goal, ...action.patch } : goal,
        ),
      };

    case 'goal/add':
      return { ...state, goals: [...state.goals, action.goal] };

    case 'goal/remove':
      return { ...state, goals: state.goals.filter((goal) => goal.id !== action.id) };

    case 'nutrition/toggleMeal': {
      const day = state.nutrition[action.date] ?? emptyNutritionDay(action.date);
      const meals = day.meals.map((done, i) => (i === action.index ? !done : done));
      return { ...state, nutrition: { ...state.nutrition, [action.date]: { ...day, meals } } };
    }

    case 'nutrition/setWater': {
      const day = state.nutrition[action.date] ?? emptyNutritionDay(action.date);
      const water = Math.max(0, Math.min(20, action.glasses));
      return { ...state, nutrition: { ...state.nutrition, [action.date]: { ...day, water } } };
    }

    case 'session/finish':
      // The live run is left alone — the runner clears it once the athlete
      // leaves the summary, so a reload mid-summary still shows the result.
      return {
        ...state,
        // Re-running a workout replaces its previous result.
        sessions: [
          ...state.sessions.filter((session) => session.workoutId !== action.session.workoutId),
          action.session,
        ].sort((a, b) => a.startedAt - b.startedAt),
      };

    case 'session/remove':
      return { ...state, sessions: state.sessions.filter((session) => session.id !== action.id) };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'run/set':
      return { ...state, run: action.run };

    case 'app/reset':
      return createInitialState();

    default:
      return state;
  }
}
