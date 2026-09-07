import { useCallback, useRef } from 'react';

/**
 * Speaks the countdown out loud. Falls back to `false` when the browser has no
 * speech synthesis, so the caller can beep instead.
 */
export function useSpeech(enabled: boolean) {
  const voiceRef = useRef<SpeechSynthesisVoice | null | undefined>(undefined);

  const pickVoice = useCallback(() => {
    if (voiceRef.current !== undefined) return voiceRef.current;
    const voices = window.speechSynthesis?.getVoices() ?? [];
    voiceRef.current =
      voices.find((voice) => voice.lang.toLowerCase().startsWith('uk')) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith('ru')) ??
      voices[0] ??
      null;
    return voiceRef.current;
  }, []);

  /** Returns true when the phrase was actually handed to the synthesiser. */
  return useCallback(
    (text: string): boolean => {
      if (!enabled || !('speechSynthesis' in window)) return false;
      try {
        const voice = pickVoice();
        if (!voice) return false;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = 1.15;
        utterance.volume = 1;
        // Never let a backlog build up — the countdown must stay in step.
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },
    [enabled, pickVoice],
  );
}

export const NUMBER_WORDS: Record<number, string> = {
  10: 'десять',
  9: "дев'ять",
  8: 'вісім',
  7: 'сім',
  6: 'шість',
  5: "п'ять",
  4: 'чотири',
  3: 'три',
  2: 'два',
  1: 'один',
};
