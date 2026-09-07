import { useCallback, useRef } from 'react';
import type { SignalTone } from '../types';

export type Cue =
  /** Countdown marker at 10 s / 5 s, and each spoken second. */
  | 'tick'
  /** A set or phase begins. */
  | 'go'
  /** Workout finished. */
  | 'finish'
  /** Tempo metronome: eccentric second. */
  | 'tempoDown'
  /** Tempo metronome: the lift. */
  | 'tempoUp';

interface Tone {
  freq: number;
  duration: number;
  gain: number;
  wave?: OscillatorType;
}

/** The countdown signals; every pack keeps the same rhythm, only the timbre differs. */
const SIGNAL_PACKS: Record<SignalTone, Record<'tick' | 'go' | 'finish', Tone[]>> = {
  beep: {
    tick: [{ freq: 660, duration: 0.1, gain: 0.16 }],
    go: [{ freq: 990, duration: 0.22, gain: 0.2 }],
    finish: [
      { freq: 660, duration: 0.14, gain: 0.18 },
      { freq: 880, duration: 0.14, gain: 0.18 },
      { freq: 1180, duration: 0.3, gain: 0.2 },
    ],
  },
  chime: {
    tick: [{ freq: 1318, duration: 0.24, gain: 0.13, wave: 'triangle' }],
    go: [
      { freq: 1318, duration: 0.16, gain: 0.15, wave: 'triangle' },
      { freq: 1760, duration: 0.4, gain: 0.16, wave: 'triangle' },
    ],
    finish: [
      { freq: 1046, duration: 0.18, gain: 0.15, wave: 'triangle' },
      { freq: 1318, duration: 0.18, gain: 0.15, wave: 'triangle' },
      { freq: 1568, duration: 0.18, gain: 0.15, wave: 'triangle' },
      { freq: 2093, duration: 0.5, gain: 0.16, wave: 'triangle' },
    ],
  },
  click: {
    tick: [{ freq: 1200, duration: 0.04, gain: 0.2, wave: 'square' }],
    go: [{ freq: 1600, duration: 0.09, gain: 0.22, wave: 'square' }],
    finish: [
      { freq: 1200, duration: 0.05, gain: 0.2, wave: 'square' },
      { freq: 1200, duration: 0.05, gain: 0.2, wave: 'square' },
      { freq: 1900, duration: 0.16, gain: 0.22, wave: 'square' },
    ],
  },
  horn: {
    tick: [{ freq: 210, duration: 0.18, gain: 0.18, wave: 'sawtooth' }],
    go: [{ freq: 320, duration: 0.42, gain: 0.2, wave: 'sawtooth' }],
    finish: [
      { freq: 210, duration: 0.22, gain: 0.18, wave: 'sawtooth' },
      { freq: 165, duration: 0.5, gain: 0.2, wave: 'sawtooth' },
    ],
  },
};

/** The metronome stays the same whatever the signal pack is. */
const TEMPO_TONES: Record<'tempoDown' | 'tempoUp', Tone[]> = {
  tempoDown: [{ freq: 440, duration: 0.06, gain: 0.12 }],
  tempoUp: [{ freq: 1046, duration: 0.12, gain: 0.18 }],
};

export const SIGNAL_TONE_LABEL: Record<SignalTone, string> = {
  beep: 'Біп',
  chime: 'Дзвіночок',
  click: 'Клац',
  horn: 'Гудок',
};

/**
 * Short WebAudio signals. The context is created lazily on the first cue, which
 * in practice happens inside a user gesture, so autoplay policies are happy.
 */
export function useAudioCue(enabled: boolean, tone: SignalTone = 'beep') {
  const contextRef = useRef<AudioContext | null>(null);

  return useCallback(
    (cue: Cue, options?: { force?: boolean; tone?: SignalTone }) => {
      if (!enabled && !options?.force) return;
      const pack = SIGNAL_PACKS[options?.tone ?? tone] ?? SIGNAL_PACKS.beep;
      const tones = cue === 'tempoDown' || cue === 'tempoUp' ? TEMPO_TONES[cue] : pack[cue];

      try {
        if (!contextRef.current) {
          const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!Ctor) return;
          contextRef.current = new Ctor();
        }
        const ctx = contextRef.current;
        if (ctx.state === 'suspended') void ctx.resume();

        let offset = 0;
        for (const item of tones) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = item.wave ?? 'sine';
          osc.frequency.value = item.freq;
          const startAt = ctx.currentTime + offset;
          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(item.gain, startAt + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + item.duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(startAt);
          osc.stop(startAt + item.duration + 0.02);
          offset += item.duration + 0.04;
        }
      } catch {
        // Audio is a nicety — never let it break the timer.
      }
    },
    [enabled, tone],
  );
}
