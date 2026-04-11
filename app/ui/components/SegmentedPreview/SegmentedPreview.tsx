import React, { useEffect, useRef, useState } from "react";

type Segment = {
  start: number;
  end: number;
};

interface SegmentedPreviewProps {
  title: string;
  videoSrc: string;
  segments: Segment[];
  emptyLabel: string;
}

export default function SegmentedPreview({
  title,
  videoSrc,
  segments,
  emptyLabel,
}: SegmentedPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const transitioningRef = useRef(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (!segments.length) {
      videoRef.current.pause();
      return;
    }
    setSegmentIndex(0);
    videoRef.current.currentTime = segments[0].start;
  }, [segments]);

  const transitionTo = (nextIndex: number) => {
    const video = videoRef.current;
    if (!video) return;
    transitioningRef.current = true;
    setIsFading(true);
    const nextStart = segments[nextIndex].start;
    setSegmentIndex(nextIndex);
    window.setTimeout(() => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = nextStart;
      window.setTimeout(() => {
        setIsFading(false);
        transitioningRef.current = false;
      }, 160);
    }, 100);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !segments.length) return;
    if (transitioningRef.current) return;
    const currentSegment = segments[segmentIndex];
    if (!currentSegment) return;
    if (video.currentTime >= currentSegment.end - 0.05) {
      const nextIndex = segmentIndex + 1;
      if (nextIndex < segments.length) {
        transitionTo(nextIndex);
      } else {
        video.pause();
      }
    }
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video || !segments.length) return;
    const currentSegment = segments[segmentIndex] ?? segments[0];
    if (
      video.currentTime < currentSegment.start ||
      video.currentTime > currentSegment.end
    ) {
      video.currentTime = currentSegment.start;
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-2xl backdrop-blur-xl">
      <div className="text-sm font-semibold text-zinc-200">{title}</div>
      {segments.length ? (
        <video
          ref={videoRef}
          src={videoSrc}
          className={`w-full rounded-xl bg-black transition-opacity duration-300 ${
            isFading ? "opacity-60" : "opacity-100"
          }`}
          controls
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
