"use client";

import { useRef, useState } from "react";
import { formatDuration } from "@/lib/audio/duration";

interface Props {
  src: string;
  title: string;
  /** Normalised peaks; when empty a neutral placeholder is drawn. */
  peaks: number[];
  /** Shown before the media element reports its own duration. */
  durationHint?: number;
}

const PLACEHOLDER = Array.from({ length: 96 }, (_, i) => 0.25 + 0.2 * Math.abs(Math.sin(i * 0.37)) + 0.1 * Math.abs(Math.sin(i * 1.7)));

/** Render with `key={src}` so a new file starts from a fresh transport state. */
export function WaveformPlayer({ src, title, peaks, durationHint }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);
  const bars = peaks.length ? peaks : PLACEHOLDER;
  const progress = duration > 0 ? current / duration : 0;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const seekTo = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
    setCurrent(audio.currentTime);
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Mettre en pause ${title}` : `Écouter ${title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_6px_16px_-6px_rgba(18,168,255,0.7)] transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        {playing ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
            <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
            <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M4 2.8v10.4a.8.8 0 0 0 1.2.7l8.6-5.2a.8.8 0 0 0 0-1.4L5.2 2.1A.8.8 0 0 0 4 2.8z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position de lecture"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatDuration(current)} sur ${formatDuration(duration)}`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seekTo(progress + 5 / Math.max(duration, 1));
            if (e.key === "ArrowLeft") seekTo(progress - 5 / Math.max(duration, 1));
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle();
            }
          }}
          className="group flex h-12 cursor-pointer items-center gap-px overflow-hidden sm:gap-[2px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/60"
        >
          {bars.map((p, i) => {
            const played = (i + 0.5) / bars.length <= progress;
            return (
              <span
                key={i}
                className={`min-w-px flex-1 rounded-full transition-colors duration-150 ${
                  peaks.length ? (played ? "bg-brand-sky" : "bg-white/30 group-hover:bg-white/40") : "animate-pulse bg-white/15"
                }`}
                style={{ height: `${Math.max(8, p * 100)}%` }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-white/55">
          <span>{formatDuration(current)}</span>
          <span>{duration ? formatDuration(duration) : "–:––"}</span>
        </div>
      </div>
    </div>
  );
}
