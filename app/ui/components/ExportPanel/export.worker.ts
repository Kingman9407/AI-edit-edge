/// <reference lib="webworker" />

/**
 * export.worker.ts
 *
 * Off-main-thread WebCodecs export pipeline using Mediabunny v1.40.1.
 *
 * Architecture:
 *  - Demux source with Mediabunny Input + EncodedPacketSink
 *  - Decode via VideoDecoder, render to OffscreenCanvas, encode via CanvasSource (VideoSampleSource under the hood)
 *  - Audio: decode entire file with OfflineAudioContext, feed segments via AudioBufferSource
 *  - Mux with Mediabunny Output → Mp4OutputFormat → BufferTarget
 *  - Hardware fallback: getFirstEncodableVideoCodec(['hevc','vp9','avc'])
 *  - Memory: frame.close() immediately after use; backpressure via decoder/encoder queue monitoring
 */

import {
  Input,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  BlobSource,
  EncodedPacketSink,
  AudioBufferSink,
  AudioBufferSource,
  CanvasSource,
  MP4,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import type { VideoCodec, InputAudioTrack } from "mediabunny";

export interface QualityOption {
  id: "fast" | "standard" | "high";
  label: string;
  desc: string;
  bitrate: number;
  maxHeight?: number;
  codec: string;
}

export type ExportWorkerMessage =
  | {
      type: "start";
      file: File;
      segments: { start: number; end: number }[];
      quality: QualityOption;
      label: string;
    }
  | { type: "abort" };

export type ExportWorkerResponse =
  | { type: "progress"; percent: number; message: string; label: string }
  | { type: "done"; blob: Blob; name: string; label: string }
  | { type: "error"; error: string; label: string };

const MAX_DECODE_QUEUE = 30;
const AUDIO_CHUNK_FRAMES = 4096;

self.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
  if (event.data.type !== "start") return;

  const { file, segments, quality, label } = event.data;

  const progress = (percent: number, message: string) => {
    self.postMessage({
      type: "progress",
      percent,
      message,
      label,
    } satisfies ExportWorkerResponse);
  };

  try {
    const blob = await runExportPipeline(file, segments, quality, progress);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    self.postMessage({
      type: "done",
      blob,
      name: `${baseName}_${label}.mp4`,
      label,
    } satisfies ExportWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
      label,
    } satisfies ExportWorkerResponse);
  }
};

async function negotiateVideoCodec(
  outW: number,
  outH: number,
  bitrate: number
): Promise<VideoCodec> {
  const preferenceOrder: VideoCodec[] = ["hevc", "vp9", "avc"];
  const codec = await getFirstEncodableVideoCodec(preferenceOrder, {
    width: outW,
    height: outH,
    bitrate,
  });

  if (codec) {
    return codec;
  }

  const swCodec = await getFirstEncodableVideoCodec(["avc"]);

  if (swCodec) {
    return swCodec;
  }

  throw new Error(
    "No supported VideoEncoder configuration found. Your browser may not support WebCodecs video encoding."
  );
}

async function runExportPipeline(
  file: File,
  segments: { start: number; end: number }[],
  quality: QualityOption,
  onProgress: (pct: number, msg: string) => void
): Promise<Blob> {
  onProgress(2, "Opening input file…");

  const input = new Input({
    source: new BlobSource(file),
    formats: [MP4],
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("No video track found in the input file.");

  const decoderConfig = await videoTrack.getDecoderConfig();
  if (!decoderConfig) {
    throw new Error("Cannot determine decoder configuration for video track.");
  }

  let outW = videoTrack.codedWidth;
  let outH = videoTrack.codedHeight;
  if (quality.maxHeight && outH > quality.maxHeight) {
    const scale = quality.maxHeight / outH;
    outW = Math.round(outW * scale);
    outH = quality.maxHeight;
  }
  outW = outW % 2 === 0 ? outW : outW + 1;
  outH = outH % 2 === 0 ? outH : outH + 1;

  onProgress(5, "Negotiating best video codec…");

  const videoCodec = await negotiateVideoCodec(outW, outH, quality.bitrate);

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context from OffscreenCanvas.");

  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: quality.bitrate,
    keyFrameInterval: 2,
    hardwareAcceleration: "prefer-hardware",
  });

  const audioTrack = await input.getPrimaryAudioTrack();
  const hasAudio = audioTrack !== null && typeof AudioContext !== "undefined";

  let audioSource: AudioBufferSource | null = null;
  if (hasAudio) {
    audioSource = new AudioBufferSource({
      codec: "aac",
      bitrate: 128_000,
    });
  }

  output.addVideoTrack(videoSource);
  if (audioSource) output.addAudioTrack(audioSource);

  await output.start();

  onProgress(10, "Starting video pipeline…");

  const totalDuration = segments.reduce((s, seg) => s + seg.end - seg.start, 0);
  let handledSec = 0;
  let framesEncoded = 0;

  const decodedFrames: VideoFrame[] = [];
  let decoderError: Error | null = null;

  const videoDecoder = new VideoDecoder({
    output: (frame) => decodedFrames.push(frame),
    error: (e) => {
      decoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  videoDecoder.configure({
    ...decoderConfig,
    hardwareAcceleration: "prefer-hardware",
  });

  const packetSink = new EncodedPacketSink(videoTrack);

  for (const seg of segments) {
    if (decoderError) throw decoderError;

    const segStartSec = seg.start;
    const segEndSec = seg.end;

    const keyPacket = await packetSink.getKeyPacket(segStartSec);
    if (!keyPacket) {
      continue;
    }

    for await (const packet of packetSink.packets(keyPacket)) {
      if (decoderError) throw decoderError;

      if (packet.timestamp > segEndSec) break;

      videoDecoder.decode(packet.toEncodedVideoChunk());

      while (videoDecoder.decodeQueueSize > MAX_DECODE_QUEUE) {
        await new Promise<void>((r) => setTimeout(r, 5));
      }

      while (decodedFrames.length > 0) {
        const frame = decodedFrames.shift()!;
        const frameTsSec = frame.timestamp / 1_000_000;

        if (frameTsSec >= segStartSec && frameTsSec <= segEndSec) {
          ctx.clearRect(0, 0, outW, outH);
          ctx.drawImage(frame, 0, 0, outW, outH);

          const relSec = Math.max(0, frameTsSec - segStartSec);
          const outTsSec = handledSec + relSec;
          const durSec = frame.duration ? frame.duration / 1_000_000 : undefined;

          await videoSource.add(outTsSec, durSec);
          framesEncoded++;
        }

        frame.close();
      }

      if (packet.timestamp > segStartSec) {
        const withinSeg = Math.min(
          (packet.timestamp - segStartSec) / (segEndSec - segStartSec),
          1
        );
        const overallPct =
          (handledSec + withinSeg * (segEndSec - segStartSec)) / totalDuration;
        onProgress(
          Math.round(10 + overallPct * 70),
          `Encoding… ${framesEncoded} frames`
        );
      }
    }

    await videoDecoder.flush();
    while (decodedFrames.length > 0) {
      const frame = decodedFrames.shift()!;
      const frameTsSec = frame.timestamp / 1_000_000;
      if (frameTsSec >= segStartSec && frameTsSec <= segEndSec) {
        ctx.clearRect(0, 0, outW, outH);
        ctx.drawImage(frame, 0, 0, outW, outH);
        const relSec = Math.max(0, frameTsSec - segStartSec);
        const outTsSec = handledSec + relSec;
        const durSec = frame.duration ? frame.duration / 1_000_000 : undefined;
        await videoSource.add(outTsSec, durSec);
        framesEncoded++;
      }
      frame.close();
    }

    handledSec += segEndSec - segStartSec;
  }

  videoDecoder.close();
  videoSource.close();

  if (hasAudio && audioSource) {
    onProgress(82, "Processing audio…");
    try {
      await processAudio(audioTrack, segments, audioSource);
    } catch (err) {
      console.warn(
        "[Worker] Audio processing failed, exporting without audio:",
        err
      );
    }
    audioSource.close();
  }

  onProgress(95, "Finalizing MP4…");
  await output.finalize();
  input[Symbol.dispose]();

  const buffer = target.buffer;
  if (!buffer) throw new Error("Muxer produced no output buffer.");

  return new Blob([buffer], { type: "video/mp4" });
}

async function processAudio(
  audioTrack: InputAudioTrack,
  segments: { start: number; end: number }[],
  audioSource: AudioBufferSource
): Promise<void> {
  const audioSink = new AudioBufferSink(audioTrack);

  for (const seg of segments) {
    for await (const wrapped of audioSink.buffers(seg.start, seg.end)) {
      const buffer = wrapped.buffer;
      const bufStart = wrapped.timestamp;
      const bufEnd = bufStart + wrapped.duration;

      let startOffsetSec = 0;
      let endOffsetSec = wrapped.duration;

      if (bufStart < seg.start) {
        startOffsetSec = seg.start - bufStart;
      }
      if (bufEnd > seg.end) {
        endOffsetSec = seg.end - bufStart;
      }

      if (startOffsetSec > 0 || endOffsetSec < wrapped.duration) {
        const startSample = Math.floor(startOffsetSec * buffer.sampleRate);
        const endSample = Math.floor(endOffsetSec * buffer.sampleRate);
        const numFrames = endSample - startSample;

        if (numFrames > 0) {
          const croppedBuffer = new AudioBuffer({
            length: numFrames,
            numberOfChannels: buffer.numberOfChannels,
            sampleRate: buffer.sampleRate,
          });
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            croppedBuffer.copyToChannel(
              buffer.getChannelData(ch).subarray(startSample, endSample),
              ch
            );
          }
          await audioSource.add(croppedBuffer);
        }
      } else {
        await audioSource.add(buffer);
      }
    }
  }
}

export {};
