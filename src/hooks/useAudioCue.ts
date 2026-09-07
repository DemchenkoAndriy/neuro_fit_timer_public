import { useCallback, useRef } from 'react';

export type Cue =
  /** Countdown marker at 10 s / 5 s. */
  | 'tick'
  /** A set or phase begins. */
  | 'go'
  /** Workout finished. */
  | 'finish'
  /** Tempo metronome: eccentric second. */
  | 'tempoDown'
  /** Tempo metronome: the lift. */
  | 'tempoUp';

const TONES: Record<Cue, { freq: number; duration: number; gain: number }[]> = {
  tick: [{ freq: 660, duration: 0.1, gain: 0.16 }],
  go: [{ freq: 990, duration: 0.22, gain: 0.2 }],
  finish: [
    { freq: 660, duration: 0.14, gain: 0.18 },
    { freq: 880, duration: 0.14, gain: 0.18 },
    { freq: 1180, duration: 0.3, gain: 0.2 },
  ],
  tempoDown: [{ freq: 440, duration: 0.06, gain: 0.12 }],
  tempoUp: [{ freq: 1046, duration: 0.12, gain: 0.18 }],
};

/**
 * Short WebAudio beeps. The context is created lazily on the first cue, which
 * in practice happens inside a user gesture, so autoplay policies are happy.
 */
export function useAudioCue(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  return useCallback(
    (cue: Cue) => {
      if (!enabled) return;
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
        for (const tone of TONES[cue]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = tone.freq;
          const startAt = ctx.currentTime + offset;
          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(startAt);
          osc.stop(startAt + tone.duration + 0.02);
          offset += tone.duration + 0.04;
        }
      } catch {
        // Audio is a nicety — never let it break the timer.
      }
    },
    [enabled],
  );
}
