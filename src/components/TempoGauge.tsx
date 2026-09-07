import { useEffect, useRef } from 'react';

interface Props {
  /** Epoch ms the set started at. */
  startedAt: number;
  /** Epoch ms of the pause, or null while running. */
  pausedAt: number | null;
  downSec: number;
  upSec: number;
  /** Fired once per beat, so the metronome lands on time. */
  onBeat?: (isDown: boolean) => void;
}

/**
 * The 4/1 gauge beside the ring. It animates on requestAnimationFrame and
 * writes straight to the DOM: a 200 ms React tick makes the column visibly
 * jerky, and this also puts the metronome beat within a frame of the second.
 */
export function TempoGauge({ startedAt, pausedAt, downSec, upSec, onBeat }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const repsRef = useRef<HTMLSpanElement>(null);

  const beatRef = useRef(onBeat);
  beatRef.current = onBeat;

  useEffect(() => {
    const cycle = Math.max(1, downSec + upSec);
    let frame = 0;
    let lastBeat: number | null = null;
    let lastCount: number | null = null;
    let lastDown: boolean | null = null;
    let lastReps: number | null = null;

    const render = () => {
      const now = pausedAt ?? Date.now();
      const elapsed = Math.max(0, (now - startedAt) / 1000);
      const position = elapsed % cycle;
      const isDown = position < downSec;
      const ratio = isDown ? position / downSec : (position - downSec) / upSec;
      // The column fills as the weight goes down and empties on the way up.
      const fill = isDown ? ratio : 1 - ratio;
      const count = isDown ? Math.ceil(downSec - position) : Math.ceil(cycle - position);
      const reps = Math.floor(elapsed / cycle);

      if (fillRef.current) fillRef.current.style.height = `${fill * 100}%`;
      if (count !== lastCount && countRef.current) {
        countRef.current.textContent = `${count}`;
        lastCount = count;
      }
      if (isDown !== lastDown) {
        if (labelRef.current) labelRef.current.textContent = isDown ? 'опускай' : 'підйом';
        rootRef.current?.classList.toggle('tempo--up', !isDown);
        lastDown = isDown;
      }
      if (reps !== lastReps && repsRef.current) {
        repsRef.current.textContent = `${reps} повт.`;
        lastReps = reps;
      }

      // One cue per whole second of the cycle.
      if (pausedAt == null) {
        const beat = Math.floor(elapsed);
        if (lastBeat !== null && beat !== lastBeat) {
          beatRef.current?.(beat % cycle < downSec);
        }
        lastBeat = beat;
      }
    };

    const loop = () => {
      render();
      frame = requestAnimationFrame(loop);
    };

    if (pausedAt != null) {
      render();
      return;
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, pausedAt, downSec, upSec]);

  return (
    <div className="tempo" ref={rootRef}>
      <span className="tempo__count num" ref={countRef} />
      <div className="tempo__track">
        <div className="tempo__fill" ref={fillRef} />
      </div>
      <span className="tempo__label" ref={labelRef} />
      <span className="tempo__reps num" ref={repsRef} />
    </div>
  );
}
