"use client";

import { useState, useRef, useEffect, ChangeEvent, useCallback } from "react";
import { encodeWavDataUrl } from "@/app/backend/functions/audio";

type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

type EditSegment = {
  id: string;
  start: number;
  end: number;
  reason?: string;
};

type VideoInsight = {
  time: number;
  description: string;
};

const AUDIO_CHUNK_SECONDS = 20;
const AUDIO_CONCURRENCY = 3;
const VIDEO_INSIGHT_INTERVAL_SECONDS = 20;
const VIDEO_INSIGHT_MAX_DIMENSION = 640;
const SCENE_SCAN_INTERVAL_SECONDS = 1;
const SCENE_SAMPLE_WIDTH = 64;
const SCENE_SAMPLE_HEIGHT = 36;
const SCENE_DIFF_FLOOR = 0.18;
const SCENE_REFINE_STEPS = 6;

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type TokenUsageSource = "audio" | "vision";

type UseVideoPlayerOptions = {
  onTokenUsage?: (source: TokenUsageSource, usage: TokenUsage) => void;
  analysis?: {
    audio: boolean;
    visual: boolean;
  };
};

export function useVideoPlayer(options: UseVideoPlayerOptions = {}) {
  const enableAudioAnalysis = options.analysis?.audio ?? true;
  const enableVisualAnalysis = options.analysis?.visual ?? true;
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [audioStatus, setAudioStatus] = useState<
    "idle" | "processing" | "done" | "error" | "no-audio"
  >("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [videoInsights, setVideoInsights] = useState<VideoInsight[]>([]);
  const [videoInsightStatus, setVideoInsightStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [videoInsightError, setVideoInsightError] = useState<string | null>(null);
  const [sceneChanges, setSceneChanges] = useState<number[]>([]);
  const [sceneStatus, setSceneStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [edits, setEdits] = useState<EditSegment[]>([]);
  const [isSkippingEdits, setIsSkippingEdits] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const onTokenUsageRef = useRef<UseVideoPlayerOptions["onTokenUsage"]>(
    options.onTokenUsage
  );

  useEffect(() => {
    onTokenUsageRef.current = options.onTokenUsage;
  }, [options.onTokenUsage]);

  // Sync muted state imperatively
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync volume imperatively
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Create object URL when file changes
  useEffect(() => {
    if (videoFile) {
      const src = URL.createObjectURL(videoFile);
      setVideoSrc(src);
      setIsPlaying(false);
      setCurrentTime(0);
      setTrimStart(0);
      setTrimEnd(100);
      setVideoWidth(0);
      setVideoHeight(0);
      setAudioSegments([]);
      setAudioStatus("idle");
      setAudioError(null);
      setAudioProgress(0);
      setVideoInsights([]);
      setVideoInsightStatus("idle");
      setVideoInsightError(null);
      setSceneChanges([]);
      setSceneStatus("idle");
      setSceneError(null);
      setEdits([]);
      return () => {
        URL.revokeObjectURL(src);
      };
    }
  }, [videoFile]);

  useEffect(() => {
    if (!videoFile || !enableAudioAnalysis) {
      setAudioSegments([]);
      setAudioStatus("idle");
      setAudioError(null);
      setAudioProgress(0);
      return;
    }
    let cancelled = false;

    const transcribeAudio = async () => {
      setAudioStatus("processing");
      setAudioError(null);
      setAudioProgress(0);
      setAudioSegments([]);

      try {
        const arrayBuffer = await videoFile.arrayBuffer();
        const audioContext = new AudioContext();
        let decoded: AudioBuffer;
        try {
          decoded = await audioContext.decodeAudioData(arrayBuffer);
        } catch {
          audioContext.close();
          if (!cancelled) {
            setAudioStatus("no-audio");
            setAudioError(null);
          }
          return;
        }
        const offline = new OfflineAudioContext(
          1,
          Math.ceil(decoded.duration * 16000),
          16000
        );
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start(0);
        const rendered = await offline.startRendering();
        audioContext.close();

        const sampleRate = rendered.sampleRate;
        const channelData = rendered.getChannelData(0);
        if (!channelData.length) {
          if (!cancelled) {
            setAudioStatus("no-audio");
            setAudioError(null);
          }
          return;
        }

        const maxSamples = channelData.length;
        const chunkSamples = Math.floor(AUDIO_CHUNK_SECONDS * sampleRate);
        const totalChunks = Math.ceil(maxSamples / chunkSamples);
        const chunkDescriptors = Array.from(
          { length: totalChunks },
          (_, index) => ({
            startSample: index * chunkSamples,
            endSample: Math.min((index + 1) * chunkSamples, maxSamples),
          })
        );
        if (!totalChunks) {
          if (!cancelled) {
            setAudioStatus("done");
            setAudioProgress(1);
          }
          return;
        }

        let completed = 0;
        let nextIndex = 0;
        const concurrency = Math.min(AUDIO_CONCURRENCY, totalChunks);

        const runWorker = async () => {
          while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= totalChunks) return;
            const { startSample, endSample } = chunkDescriptors[index];
            const chunk = channelData.subarray(startSample, endSample);
            const audioDataUrl = await encodeWavDataUrl(chunk, sampleRate);
            const startTime = startSample / sampleRate;
            const endTime = endSample / sampleRate;

            const res = await fetch("/api/audio/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio: audioDataUrl,
                startTime,
                endTime,
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.error || "Audio transcription failed");
            }

            const transcript = data?.transcript || "";
            const rawCategory = data?.category;
            const category: "speech" | "music" | "sfx" =
              rawCategory === "speech" ||
                rawCategory === "music" ||
                rawCategory === "sfx"
                ? rawCategory
                : data?.isMusic
                  ? "music"
                  : transcript
                    ? "speech"
                    : "sfx";
            const segment = {
              start: startTime,
              end: endTime,
              transcript,
              category,
            };

            if (!cancelled) {
              if (data?.usage) {
                onTokenUsageRef.current?.("audio", data.usage);
              }
              setAudioSegments((prev) => {
                const exists = prev.some(
                  (item) => item.start === segment.start && item.end === segment.end
                );
                if (exists) return prev;
                const next = [...prev, segment].sort((a, b) => a.start - b.start);
                return next;
              });
              completed += 1;
              setAudioProgress(completed / totalChunks);
            }
          }
        };

        await Promise.all(
          Array.from({ length: concurrency }, () => runWorker())
        );

        if (!cancelled) {
          setAudioStatus("done");
        }
      } catch (error) {
        if (!cancelled) {
          setAudioStatus("error");
          setAudioError(
            error instanceof Error ? error.message : "Audio processing failed"
          );
        }
      }
    };

    transcribeAudio();

    return () => {
      cancelled = true;
    };
  }, [videoFile, enableAudioAnalysis]);

  useEffect(() => {
    if (!videoFile || !videoSrc || !enableVisualAnalysis) {
      setVideoInsights([]);
      setVideoInsightStatus("idle");
      setVideoInsightError(null);
      setSceneChanges([]);
      setSceneStatus("idle");
      setSceneError(null);
      return;
    }
    let cancelled = false;

    const captureFrameFromVideo = (video: HTMLVideoElement) => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return null;

      const scale = Math.min(
        1,
        VIDEO_INSIGHT_MAX_DIMENSION / Math.max(width, height)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.7);
    };

    const captureSignature = (video: HTMLVideoElement) => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return null;
      const canvas = document.createElement("canvas");
      canvas.width = SCENE_SAMPLE_WIDTH;
      canvas.height = SCENE_SAMPLE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      return data;
    };

    const diffSignatures = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
      const length = Math.min(a.length, b.length);
      let sum = 0;
      for (let i = 0; i < length; i += 4) {
        sum += Math.abs(a[i] - b[i]);
        sum += Math.abs(a[i + 1] - b[i + 1]);
        sum += Math.abs(a[i + 2] - b[i + 2]);
      }
      const denom = (length / 4) * 3 * 255;
      return denom ? sum / denom : 0;
    };

    const waitForReady = (video: HTMLVideoElement) =>
      new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Video not ready for seeking"));
        };
        const cleanup = () => {
          video.removeEventListener("loadeddata", onReady);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("loadeddata", onReady);
        video.addEventListener("canplay", onReady);
        video.addEventListener("error", onError);
      });

    const seekTo = async (video: HTMLVideoElement, time: number) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(ok);
        };
        const timeout = window.setTimeout(() => finish(false), 2000);
        const finishWithClear = (ok: boolean) => {
          window.clearTimeout(timeout);
          finish(ok);
        };
        const onSeeked = () => finishWithClear(true);
        const onError = () => finishWithClear(false);
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
        };

        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        video.currentTime = time;
      });

    const signatureAt = async (video: HTMLVideoElement, time: number) => {
      const ok = await seekTo(video, time);
      if (!ok) return null;
      return captureSignature(video);
    };

    const refineSceneCut = async (
      video: HTMLVideoElement,
      startTime: number,
      endTime: number,
      threshold: number
    ) => {
      let leftTime = startTime;
      let rightTime = endTime;
      let leftSig = await signatureAt(video, leftTime);
      let rightSig = await signatureAt(video, rightTime);
      if (!leftSig || !rightSig) return null;

      for (let step = 0; step < SCENE_REFINE_STEPS; step += 1) {
        const mid = (leftTime + rightTime) / 2;
        const midSig = await signatureAt(video, mid);
        if (!midSig) break;
        const diffLeft = diffSignatures(leftSig, midSig);
        const diffRight = diffSignatures(midSig, rightSig);
        if (diffLeft >= threshold) {
          rightTime = mid;
          rightSig = midSig;
        } else if (diffRight >= threshold) {
          leftTime = mid;
          leftSig = midSig;
        } else {
          break;
        }
      }

      return (leftTime + rightTime) / 2;
    };

    const analyzeVideo = async () => {
      setVideoInsightStatus("processing");
      setVideoInsightError(null);
      setVideoInsights([]);
      setSceneStatus("processing");
      setSceneError(null);
      setSceneChanges([]);

      const probe = document.createElement("video");
      probe.preload = "auto";
      probe.muted = true;
      probe.playsInline = true;
      probe.src = videoSrc;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Failed to load video for analysis"));
        };
        const cleanup = () => {
          probe.removeEventListener("loadedmetadata", onLoaded);
          probe.removeEventListener("error", onError);
        };
        probe.addEventListener("loadedmetadata", onLoaded);
        probe.addEventListener("error", onError);
      });

      await waitForReady(probe);

      const duration = probe.duration;
      if (!duration || !Number.isFinite(duration)) {
        setVideoInsightStatus("error");
        setVideoInsightError("Video duration unavailable for analysis");
        setSceneStatus("error");
        setSceneError("Video duration unavailable for scene analysis");
        return;
      }

      const scanInterval = Math.max(0.5, SCENE_SCAN_INTERVAL_SECONDS);
      let prevSig: Uint8ClampedArray | null = null;
      let prevTime = 0;
      const diffs: Array<{ start: number; end: number; diff: number }> = [];

      for (let t = 0; t <= duration; t += scanInterval) {
        if (cancelled) return;
        const safeTime = Math.min(Math.max(t, 0), Math.max(duration - 0.1, 0));
        const sig = await signatureAt(probe, safeTime);
        if (!sig) continue;
        if (prevSig) {
          diffs.push({
            start: prevTime,
            end: safeTime,
            diff: diffSignatures(prevSig, sig),
          });
        }
        prevSig = sig;
        prevTime = safeTime;
      }

      const diffValues = diffs.map((item) => item.diff).sort((a, b) => a - b);
      const median =
        diffValues.length > 0
          ? diffValues[Math.floor(diffValues.length / 2)]
          : 0;
      const threshold = Math.max(SCENE_DIFF_FLOOR, median * 3);
      const candidates = diffs.filter((item) => item.diff >= threshold);
      const refined: number[] = [];

      for (const candidate of candidates) {
        if (cancelled) return;
        const refinedTime = await refineSceneCut(
          probe,
          candidate.start,
          candidate.end,
          threshold
        );
        if (refinedTime !== null) {
          refined.push(refinedTime);
        }
      }

      let sceneTimes: number[] = [];
      if (!cancelled) {
        const unique = Array.from(
          new Set(refined.map((time) => Number(time.toFixed(2))))
        ).sort((a, b) => a - b);
        setSceneChanges(unique);
        setSceneStatus("done");
        setSceneError(null);
        sceneTimes = unique;
      }
      if (!sceneTimes.length) {
        sceneTimes = [];
      }

      const times: number[] = [];
      if (sceneTimes.length) {
        times.push(0, ...sceneTimes);
      } else {
        const interval = Math.max(1, VIDEO_INSIGHT_INTERVAL_SECONDS);
        for (let t = 0; t <= duration; t += interval) {
          times.push(t);
        }
      }
      if (!times.length) {
        times.push(0);
      } else if (times[times.length - 1] < duration) {
        times.push(duration);
      }
      const dedupedTimes = Array.from(
        new Set(times.map((time) => Number(time.toFixed(2))))
      ).sort((a, b) => a - b);

      let successCount = 0;
      for (const time of dedupedTimes) {
        if (cancelled) return;
        const safeTime = Math.min(Math.max(time, 0), Math.max(duration - 0.1, 0));
        const ok = await seekTo(probe, safeTime);
        if (!ok) {
          continue;
        }
        if (cancelled) return;
        const image = captureFrameFromVideo(probe);
        if (!image) continue;

        const res = await fetch("/api/video/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, time: safeTime }),
        });
        const raw = await res.text();
        let data: any = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = null;
          }
        }
        if (!res.ok) {
          const message =
            data?.error || data?.message || raw || "Video recognition failed";
          throw new Error(message);
        }
        if (!data) {
          throw new Error("Invalid response from video recognition.");
        }
        if (!cancelled) {
          if (data?.usage) {
            onTokenUsageRef.current?.("vision", data.usage);
          }
          setVideoInsights((prev) => [
            ...prev,
            {
              time: safeTime,
              description: data?.description || "Scene detected",
            },
          ]);
          successCount += 1;
        }
      }

      if (!cancelled) {
        if (successCount > 0) {
          setVideoInsightStatus("done");
          setVideoInsightError(null);
        } else {
          setVideoInsightStatus("error");
          setVideoInsightError("Unable to capture frames for analysis.");
        }
      }
    };

    analyzeVideo().catch((error) => {
      if (!cancelled) {
        setVideoInsightStatus("error");
        setVideoInsightError(
          error instanceof Error ? error.message : "Video analysis failed"
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [videoFile, videoSrc, enableVisualAnalysis]);

  const loadVideoFile = useCallback((file: File | null) => {
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
    } else if (!file) {
      setVideoFile(null);
    }
  }, []);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);

      if (videoRef.current.duration && videoRef.current.duration !== duration) {
        if (videoRef.current.duration !== Infinity) {
          setDuration(videoRef.current.duration);
        }
      }

      // Automatically skip removed segments (edits) if enabled
      if (isSkippingEdits && edits.length > 0) {
        const sortedEdits = [...edits].sort((a, b) => a.start - b.start);
        const currentEdit = sortedEdits.find(
          (e) => current >= e.start - 0.01 && current < e.end
        );
        if (currentEdit) {
          videoRef.current.currentTime = currentEdit.end;
          return;
        }
      }

      if (isEditorMode && duration > 0) {
        const endSeconds = (trimEnd / 100) * duration;
        if (current >= endSeconds && isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoWidth(videoRef.current.videoWidth);
      setVideoHeight(videoRef.current.videoHeight);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const handleEnded = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (!newMutedState && volume === 0) {
      setVolume(1);
    }
  };

  const handleTrimStartChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (val < trimEnd) {
      setTrimStart(val);
      if (videoRef.current) {
        videoRef.current.currentTime = (val / 100) * duration;
      }
    }
  };

  const handleTrimEndChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (val > trimStart) {
      setTrimEnd(val);
    }
  };

  const resetTrim = () => {
    setTrimStart(0);
    setTrimEnd(100);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const clearVideo = useCallback(() => {
    setVideoSrc(null);
    setVideoFile(null);
    setVideoWidth(0);
    setVideoHeight(0);
    setAudioSegments([]);
    setAudioStatus("idle");
    setAudioError(null);
    setAudioProgress(0);
    setEdits([]);
  }, []);

  const toggleEditorMode = () => setIsEditorMode(!isEditorMode);

  const requestFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const addEdit = useCallback((edit: Omit<EditSegment, "id">) => {
    setEdits((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...edit,
      },
    ]);
  }, []);

  const clearEdits = () => setEdits([]);
  const undoLastEdit = () =>
    setEdits((prev) => (prev.length ? prev.slice(0, -1) : prev));
  const removeEdit = (id: string) =>
    setEdits((prev) => prev.filter((edit) => edit.id !== id));

  const replaceEdits = useCallback((next: EditSegment[]) => {
    setEdits(
      next.map((edit) => ({
        id: edit.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        start: edit.start,
        end: edit.end,
        reason: edit.reason,
      }))
    );
  }, []);

  const seekToTime = (time: number, play = false) => {
    if (!videoRef.current || !Number.isFinite(time)) return;
    videoRef.current.currentTime = Math.max(0, time);
    setCurrentTime(Math.max(0, time));
    if (play) {
      void videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const captureFrame = (maxDimension = 640) => {
    const video = videoRef.current;
    if (!video) return null;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  // Calculate active timeline metrics
  const timelineDuration = duration - edits.reduce((acc, e) => acc + (e.end - e.start), 0);
  
  const getTimelineCurrentTime = () => {
    if (!edits.length) return currentTime;
    const sortedEdits = [...edits].sort((a, b) => a.start - b.start);
    let removedBefore = 0;
    for (const edit of sortedEdits) {
      if (currentTime >= edit.end) {
        removedBefore += (edit.end - edit.start);
      } else if (currentTime > edit.start) {
        removedBefore += (currentTime - edit.start);
      }
    }
    return Math.max(0, currentTime - removedBefore);
  };

  const timelineCurrentTime = getTimelineCurrentTime();

  return {
    // State
    videoFile,
    videoSrc,
    isPlaying,
    duration,
    currentTime,
    timelineDuration,
    timelineCurrentTime,
    isSkippingEdits,
    volume,
    isMuted,
    trimStart,
    trimEnd,
    isEditorMode,
    videoWidth,
    videoHeight,
    audioSegments,
    audioStatus,
    audioError,
    audioProgress,
    videoInsights,
    videoInsightStatus,
    videoInsightError,
    sceneChanges,
    sceneStatus,
    sceneError,
    edits,
    // Refs
    videoRef,
    progressRef,
    // Handlers
    handleFileUpload,
    loadVideoFile,
    togglePlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleEnded,
    handleProgressClick,
    handleVolumeChange,
    toggleMute,
    handleTrimStartChange,
    handleTrimEndChange,
    toggleIsSkippingEdits: () => setIsSkippingEdits((prev) => !prev),
    resetTrim,
    clearVideo,
    toggleEditorMode,
    requestFullscreen,
    addEdit,
    clearEdits,
    undoLastEdit,
    removeEdit,
    captureFrame,
    seekToTime,
    replaceEdits,
  };
}
