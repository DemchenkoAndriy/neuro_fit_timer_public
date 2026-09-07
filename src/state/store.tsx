import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { AppState } from '../types';
import { createInitialState, STATE_VERSION } from './initialState';
import { reducer, type Action } from './reducer';

const STORAGE_KEY = 'neurofit.state.v1';

/**
 * Older formats had a boolean `settings.sound`, no warm-up phase and no
 * per-set timings. Carry the history over instead of wiping it, filling the
 * new fields with zeros, and drop any run that was mid-flight.
 */
function migrate(parsed: Record<string, unknown>, base: AppState): AppState {
  const stored = parsed as Partial<AppState> & { settings?: { sound?: boolean } };
  const soundMode = stored.settings?.sound === false ? 'off' : base.settings.soundMode;
  return {
    ...base,
    ...(stored as Partial<AppState>),
    version: STATE_VERSION,
    settings: { ...base.settings, ...stored.settings, soundMode },
    sessions: (stored.sessions ?? base.sessions).map((session) => ({
      ...session,
      warmupSec: session.warmupSec ?? 0,
      logs: (session.logs ?? []).map((log) => ({
        ...log,
        warmupSec: log.warmupSec ?? 0,
        sets: log.sets.map((set) => ({
          ...set,
          workSec: set.workSec ?? 0,
          restSec: set.restSec ?? 0,
        })),
      })),
    })),
    run: null,
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed.program) return createInitialState();
    const base = createInitialState();
    if (parsed.version !== STATE_VERSION) {
      return migrate(parsed as Record<string, unknown>, base);
    }
    // Merge over a fresh state so a field added later is never undefined.
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      profile: { ...base.profile, ...parsed.profile },
    } as AppState;
  } catch {
    return createInitialState();
  }
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode / quota — the app still works, it just won't remember.
    }
  }, [state]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error('useAppState must be used inside <StoreProvider>');
  return state;
}

export function useDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useDispatch must be used inside <StoreProvider>');
  return dispatch;
}

/** Convenience: the settings object, memoised for effect dependencies. */
export function useSettings() {
  const { settings } = useAppState();
  return useMemo(() => settings, [settings]);
}

export function clearStoredState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
