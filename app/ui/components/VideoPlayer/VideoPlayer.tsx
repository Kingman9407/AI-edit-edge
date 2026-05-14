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

export type AudioOverlay = {
  id: string;
  file: File;
  videoStart: number;
  videoEnd: number;
  volume: number;
  label?: string;
};

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  progressRef: React.RefObject<HTMLDivElement | null>;
  videoSrc: string;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  timelineDuration: number;
  timelineCurrentTime: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onEnded: () => void;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onToggleMute: () => void;
  onRequestFullscreen: () => void;
  audioOverlays?: AudioOverlay[];
}

export default function VideoPlayer({
  videoRef,
  progressRef,
  videoSrc,
  isPlaying,
  duration,
  currentTime,
  timelineDuration,
  timelineCurrentTime,
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
  audioOverlays = [],
}: VideoPlayerProps) {
  // Use timeline metrics for display if available, otherwise fallback to physical metrics
  const displayTime = timelineCurrentTime ?? currentTime;
  const displayDuration = timelineDuration ?? duration;
  
  // Real-time audio overlay synchronization
  const audioRefs = React.useRef<{ [id: string]: HTMLAudioElement }>({});

  React.useEffect(() => {
    // Cleanup removed audio refs
    const currentIds = new Set(audioOverlays.map(o => o.id));
    Object.keys(audioRefs.current).forEach(id => {
      if (!currentIds.has(id)) {
        if (audioRefs.current[id]) {
          audioRefs.current[id].pause();
          URL.revokeObjectURL(audioRefs.current[id].src);
          delete audioRefs.current[id];
        }
      }
    });

    // Initialize new audio refs
    audioOverlays.forEach(overlay => {
      if (!audioRefs.current[overlay.id]) {
        const audio = new Audio(URL.createObjectURL(overlay.file));
        audio.preload = "auto";
        audioRefs.current[overlay.id] = audio;
      }
      
      const audio = audioRefs.current[overlay.id];
      // Update volume with master mute override
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, overlay.volume * volume));
      const naturalEnd = Number.isFinite(audio.duration)
        ? overlay.videoStart + audio.duration
        : overlay.videoEnd;
      const overlayEnd = Math.min(overlay.videoEnd, naturalEnd);
      
      // Calculate where the audio should be playing based on physical video time
      if (currentTime >= overlay.videoStart && currentTime < overlayEnd) {
        const expectedAudioTime = currentTime - overlay.videoStart;
        if (Math.abs(audio.currentTime - expectedAudioTime) > 0.25) {
          audio.currentTime = expectedAudioTime;
        }
        if (isPlaying && audio.paused) {
          audio.play().catch(() => {});
        } else if (!isPlaying && !audio.paused) {
          audio.pause();
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
        audio.currentTime = 0;
      }
    });
  }, [audioOverlays, currentTime, isPlaying, volume, isMuted]);

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
