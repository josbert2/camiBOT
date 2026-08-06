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
 * arrastrable y manijas de inicio/fin. Controla su propio <video> de preview.
 */
export function VideoTrimmer({
  src,
  duration,
  start,
  end,
  onChange,
  disabled,
}: {
  src: string;
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'start' | 'end' | 'seek' | null>(null);

  const [thumbs, setThumbs] = useState<string[]>([]);
  const [current, setCurrent] = useState(start);
  const [playing, setPlaying] = useState(false);

  // Genera el filmstrip muestreando frames con un <video> offscreen.
  useEffect(() => {
    let cancelled = false;
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.crossOrigin = 'anonymous';
    const canvas = document.createElement('canvas');

    async function grabAt(t: number): Promise<string | null> {
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
        v.currentTime = Math.min(duration - 0.05, Math.max(0, t));
      });
    }

    async function run() {
      await new Promise<void>((res) => {
        if (v.readyState >= 1) return res();
        v.addEventListener('loadedmetadata', () => res(), { once: true });
      });
      const out: string[] = [];
      for (let i = 0; i < THUMB_COUNT; i++) {
        if (cancelled) return;
        const t = (duration * (i + 0.5)) / THUMB_COUNT;
        const url = await grabAt(t);
        if (url) out.push(url);
        if (!cancelled) setThumbs([...out]);
      }
    }

    run();
    return () => {
      cancelled = true;
      v.src = '';
    };
  }, [src, duration]);

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(duration, Math.max(0, t));
    setCurrent(v.currentTime);
  }, [duration]);

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

  // Drag de manijas / playhead, throttleado a un frame para que no jankee.
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
      if (!mode) return;
      const t = ratioFromX(lastX) * duration;
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
  }, [duration, start, end, onChange, seekTo]);

  function beginDrag(mode: 'start' | 'end' | 'seek', e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    dragRef.current = mode;
    if (mode === 'seek') {
      const strip = stripRef.current;
      if (strip) {
        const r = strip.getBoundingClientRect();
        seekTo(((e.clientX - r.left) / r.width) * duration);
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
          className="max-h-[380px] w-full object-contain"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrent(t);
            if (t >= end) {
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
          {fmt(current)} <span className="text-muted-foreground">/ {fmt(duration)}</span>
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
        {/* Miniaturas */}
        <div className="absolute inset-0 flex">
          {thumbs.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={t}
              alt=""
              draggable={false}
              className="h-full flex-1 object-cover opacity-70"
            />
          ))}
        </div>

        {/* Zonas descartadas */}
        <div
          className="absolute inset-y-0 left-0 bg-background/70"
          style={{ width: `${pct(start)}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-background/70"
          style={{ width: `${100 - pct(end)}%` }}
        />

        {/* Marco de selección */}
        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-primary"
          style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
        />

        {/* Manija inicio */}
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

        {/* Manija fin */}
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

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-accent"
          style={{ left: `${pct(current)}%` }}
        >
          <span className="absolute -top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-accent" />
        </div>
      </div>
    </div>
  );
}
