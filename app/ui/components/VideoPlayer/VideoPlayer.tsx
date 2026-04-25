import React, { ChangeEvent } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Scissors,
} from "lucide-react";
import { formatTime } from "@/app/backend/functions/formatTime";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  progressRef: React.RefObject<HTMLDivElement | null>;
  videoSrc: string;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  onToggleMute: () => void;
  onRequestFullscreen: () => void;
}

export default function VideoPlayer({
  videoRef,
  progressRef,
  videoSrc,
  isPlaying,
  duration,
  currentTime,
  volume,
  isMuted,
  onTogglePlay,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onProgressClick,
  onVolumeChange,
  onToggleMute,
  onRequestFullscreen,
}: VideoPlayerProps) {
  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
      <video
        ref={videoRef}
        src={videoSrc}
        className="h-full w-full object-contain"
        onClick={onTogglePlay}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        {/* Progress Bar */}
        <div className="mb-4 flex items-center gap-4">
          <span className="text-xs font-medium text-zinc-300 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div
            ref={progressRef}
            className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
            onClick={onProgressClick}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-blue-500 transition-all ease-linear"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-zinc-300 w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={onTogglePlay}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
            </button>

            <div className="flex items-center gap-2 group/volume">
              <button
                onClick={onToggleMute}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} />
                ) : (
                  <Volume2 size={20} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={onVolumeChange}
                className="w-0 opacity-0 transition-all duration-300 ease-in-out group-hover/volume:w-20 group-hover/volume:opacity-100 accent-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onRequestFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
