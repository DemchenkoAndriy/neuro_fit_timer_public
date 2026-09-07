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

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== STATE_VERSION || !parsed.program) return createInitialState();
    // Merge over a fresh state so a field added later is never undefined.
    const base = createInitialState();
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
