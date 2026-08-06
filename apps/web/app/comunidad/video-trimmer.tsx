'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, PauseIcon } from '@hugeicons/core-free-icons';

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${m}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

const THUMB_COUNT = 10;

/**
 * Timeline de recorte tipo editor: filmstrip de miniaturas, playhead
 * arrastrable y manijas de inicio/fin. Controla su propio <video> de preview
 * y lee la duración por su cuenta (robusto ante metadata que no leyó inspect).
 */
export function VideoTrimmer({
  src,
  duration,
  start,
  end,
  onChange,
  onDurationChange,
  disabled,
}: {
  src: string;
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onDurationChange?: (duration: number) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'start' | 'end' | 'seek' | null>(null);

  const [dur, setDur] = useState(duration || 0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [current, setCurrent] = useState(start);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (duration > 0) setDur(duration);
  }, [duration]);

  // Aprende la duración real del propio video si el prop vino en 0.
  const learnDuration = useCallback(
    (d: number) => {
      if (!Number.isFinite(d) || d <= 0) return;
      setDur(d);
      onDurationChange?.(d);
      if (end <= 0) onChange(0, d);
    },
    [end, onChange, onDurationChange],
  );

  // Filmstrip: muestrea frames con un <video> offscreen (usa su propia duración).
  useEffect(() => {
    let cancelled = false;
    const v = document.createElement('video');
    v.muted = true;
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    const canvas = document.createElement('canvas');

    async function grabAt(t: number, total: number): Promise<string | null> {
      return new Promise((resolve) => {
        const onSeeked = () => {
          v.removeEventListener('seeked', onSeeked);
          try {
            const w = 160;
            const h = v.videoHeight ? Math.round((v.videoHeight / v.videoWidth) * w) : 90;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(v, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          } catch {
            resolve(null);
          }
        };
        v.addEventListener('seeked', onSeeked);
        v.currentTime = Math.min(total - 0.05, Math.max(0, t));
      });
    }

    async function run() {
      const total = await new Promise<number>((res) => {
        const done = () => res(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0);
        v.addEventListener('loadedmetadata', done, { once: true });
        v.addEventListener('error', () => res(0), { once: true });
        setTimeout(() => res(0), 10000);
        v.src = src;
        if (v.readyState >= 1) done();
      });
      if (cancelled || total <= 0) return;
      learnDuration(total);
      const out: string[] = [];
      for (let i = 0; i < THUMB_COUNT; i++) {
        if (cancelled) return;
        const url = await grabAt((total * (i + 0.5)) / THUMB_COUNT, total);
        if (url) out.push(url);
        if (!cancelled) setThumbs([...out]);
      }
    }

    run();
    return () => {
      cancelled = true;
      v.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const pct = (t: number) => (dur > 0 ? (t / dur) * 100 : 0);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(dur || t, Math.max(0, t));
      setCurrent(v.currentTime);
    },
    [dur],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end - 0.02) v.currentTime = start;
      v.play();
    } else {
      v.pause();
    }
  }, [start, end]);

  // Drag throttleado a un frame.
  useEffect(() => {
    let raf = 0;
    let lastX = 0;
    function ratioFromX(clientX: number): number {
      const strip = stripRef.current;
      if (!strip) return 0;
      const r = strip.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    }
    function apply() {
      raf = 0;
      const mode = dragRef.current;
      if (!mode || dur <= 0) return;
      const t = ratioFromX(lastX) * dur;
      if (mode === 'start') onChange(Math.min(t, end - 0.5), end);
      else if (mode === 'end') onChange(start, Math.max(t, start + 0.5));
      else seekTo(t);
    }
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return;
      lastX = e.clientX;
      if (!raf) raf = requestAnimationFrame(apply);
    }
    function onUp() {
      dragRef.current = null;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [dur, start, end, onChange, seekTo]);

  function beginDrag(mode: 'start' | 'end' | 'seek', e: React.PointerEvent) {
    if (disabled || dur <= 0) return;
    e.preventDefault();
    dragRef.current = mode;
    if (mode === 'seek') {
      const strip = stripRef.current;
      if (strip) {
        const r = strip.getBoundingClientRect();
        seekTo(((e.clientX - r.left) / r.width) * dur);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="auto"
          className="max-h-[380px] w-full object-contain"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => learnDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrent(t);
            if (end > 0 && t >= end) {
              e.currentTarget.pause();
              e.currentTarget.currentTime = start;
            }
          }}
        />
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={disabled}
          className="text-foreground/90 transition hover:text-accent disabled:opacity-40"
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} className="h-5 w-5" />
        </button>
        <span className="text-[11px] tabular-nums tracking-wide text-foreground/80">
          {fmt(current)} <span className="text-muted-foreground">/ {fmt(dur)}</span>
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-primary">
          recorte {Math.max(0, end - start).toFixed(1)}s
        </span>
      </div>

      {/* Timeline / filmstrip */}
      <div
        ref={stripRef}
        onPointerDown={(e) => beginDrag('seek', e)}
        className="relative h-16 w-full touch-none select-none overflow-hidden border-2 border-border bg-black"
      >
        <div className="absolute inset-0 flex">
          {thumbs.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={t} alt="" draggable={false} className="h-full flex-1 object-cover opacity-70" />
          ))}
        </div>

        <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: `${pct(start)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-background/70" style={{ width: `${100 - pct(end)}%` }} />

        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-primary"
          style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
        />

        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            beginDrag('start', e);
          }}
          className="absolute inset-y-0 z-10 flex w-3 cursor-ew-resize items-center justify-center bg-primary"
          style={{ left: `calc(${pct(start)}% - 6px)` }}
        >
          <span className="h-5 w-0.5 bg-primary-foreground/70" />
        </div>

        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            beginDrag('end', e);
          }}
          className="absolute inset-y-0 z-10 flex w-3 cursor-ew-resize items-center justify-center bg-primary"
          style={{ left: `calc(${pct(end)}% - 6px)` }}
        >
          <span className="h-5 w-0.5 bg-primary-foreground/70" />
        </div>

        <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-accent" style={{ left: `${pct(current)}%` }}>
          <span className="absolute -top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-accent" />
        </div>
      </div>
    </div>
  );
}
