'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute02Icon,
  FullScreenIcon,
  Download04Icon,
} from '@hugeicons/core-free-icons';

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Reproductor con estética tactical: controles propios (play, scrubber, tiempo,
 * mute, fullscreen), botón central y auto-hide. Reemplaza al <video controls>.
 */
export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  className,
}: {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [bufferedPct, setBufferedPct] = useState(0);

  const download = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = src.split('/').pop()?.split('?')[0] || 'clip.mp4';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback (ej. iOS): abrir en pestaña nueva para guardar manualmente.
      window.open(src, '_blank');
    } finally {
      setDownloading(false);
    }
  }, [src, downloading]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const volIcon = muted || volume === 0 ? VolumeMute02Icon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  const setVol = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.readyState < 3) setBuffering(true);
      v.play();
    } else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null;
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;

    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    if (el?.requestFullscreen) {
      // Android / desktop: pantalla completa del contenedor (controles propios).
      el.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      // iOS Safari: sólo el <video> va a fullscreen (con controles nativos).
      video.webkitEnterFullscreen();
    }
  }, []);

  function seekFromClientX(clientX: number) {
    const v = videoRef.current;
    const track = trackRef.current;
    if (!v || !track || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrent(v.currentTime);
  }

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2600);
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden bg-black ${
        fullscreen ? 'flex h-full w-full items-center justify-center' : ''
      } ${className ?? ''}`}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        preload={autoPlay ? 'auto' : 'metadata'}
        className={`w-full object-contain ${fullscreen ? 'h-full max-h-screen' : 'max-h-[70vh]'}`}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          revealControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onStalled={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length && v.duration) {
            setBufferedPct((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
          }
        }}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
      />

      {/* Spinner de carga / buffering */}
      {buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/25 border-t-primary" />
        </div>
      )}

      {/* Botón central de play (cuando está pausado y no está cargando) */}
      {!playing && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reproducir"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="hud-panel-strong flex h-16 w-16 items-center justify-center bg-background/70 backdrop-blur-sm transition group-hover:bg-background/80">
            <HugeiconsIcon icon={PlayIcon} className="ml-0.5 h-7 w-7 text-primary" />
          </span>
        </button>
      )}

      {/* Barra de controles */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 ${
          controlsVisible || !started ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Scrubber */}
        <div
          ref={trackRef}
          onClick={(e) => seekFromClientX(e.clientX)}
          className="group/track relative mb-2 h-1 cursor-pointer bg-white/20"
        >
          <div className="absolute left-0 top-0 h-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
          <div className="absolute left-0 top-0 h-full bg-primary" style={{ width: `${pct}%` }} />
          <div
            className="absolute top-1/2 h-3 w-1.5 -translate-y-1/2 -translate-x-1/2 bg-accent opacity-0 transition-opacity group-hover/track:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="text-foreground/90 transition hover:text-accent"
          >
            <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} className="h-5 w-5" />
          </button>

          <span className="text-[11px] tabular-nums tracking-wide text-foreground/80">
            {fmt(current)} <span className="text-muted-foreground">/ {fmt(duration)}</span>
          </span>

          <div className="group/vol ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              className="text-foreground/90 transition hover:text-accent"
            >
              <HugeiconsIcon icon={volIcon} className="h-5 w-5" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              aria-label="Volumen"
              className="h-1 w-0 cursor-pointer opacity-0 accent-accent transition-all duration-200 group-hover/vol:w-16 group-hover/vol:opacity-100"
            />
          </div>

          <button
            type="button"
            onClick={download}
            disabled={downloading}
            aria-label="Descargar"
            title="Descargar"
            className="text-foreground/90 transition hover:text-accent disabled:opacity-50"
          >
            <HugeiconsIcon icon={Download04Icon} className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
            className="text-foreground/90 transition hover:text-accent"
          >
            <HugeiconsIcon icon={FullScreenIcon} className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
