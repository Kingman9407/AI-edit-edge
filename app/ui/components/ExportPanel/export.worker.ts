/// <reference lib="webworker" />

/**
 * export.worker.ts
 *
 * Off-main-thread WebCodecs export pipeline using Mediabunny v1.44.2.
 *
 * Architecture:
 *  - Demux source with Mediabunny Input + EncodedPacketSink
 *  - Decode via VideoDecoder, render to OffscreenCanvas, encode via CanvasSource
 *  - Audio passthrough: EncodedAudioPacketSource (no decode, fastest)
 *  - Audio mixing: pre-decoded PCM from main thread → AudioSampleSource
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
  EncodedAudioPacketSource,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  CanvasSource,
  MP4,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import type { VideoCodec, AudioCodec, InputAudioTrack } from "mediabunny";

export interface QualityOption {
  id: "fast" | "standard" | "high";
  label: string;
  desc: string;
  bitrate: number;
  maxHeight?: number;
  codec: string;
}

export type MutedSegment = { start: number; end: number };

/** Raw PCM data pre-decoded on the main thread */
export type DecodedPCM = {
  channels: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  length: number; // number of sample frames
  duration: number; // seconds
};

export type AudioOverlayPCM = {
  /** Pre-decoded PCM data (decoded on main thread) */
  pcm: DecodedPCM;
  /** Start time in the VIDEO timeline (seconds) */
  videoStart: number;
  /** End time in the VIDEO timeline (seconds) */
  videoEnd: number;
  /** Mix volume 0–1 */
  volume: number;
};

export type ExportWorkerMessage =
  | {
      type: "start";
      file: File;
      segments: { start: number; end: number }[];
      quality: QualityOption;
      label: string;
      /** Ranges inside kept segments whose audio should be silenced */
      mutedSegments?: MutedSegment[];
      /** Pre-decoded overlay audio PCM data */
      audioOverlaysPCM?: AudioOverlayPCM[];
      /** Pre-decoded native audio PCM (from the source video file) */
      nativeAudioPCM?: DecodedPCM | null;
    }
  | { type: "abort" };

export type ExportWorkerResponse =
  | { type: "progress"; percent: number; message: string; label: string }
  | { type: "done"; blob: Blob; name: string; label: string }
  | { type: "error"; error: string; label: string };

const MAX_DECODE_QUEUE = 30;

self.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
  if (event.data.type !== "start") return;

  const {
    file,
    segments,
    quality,
    label,
    mutedSegments = [],
    audioOverlaysPCM = [],
    nativeAudioPCM = null,
  } = event.data;

  const progress = (percent: number, message: string) => {
    self.postMessage({
      type: "progress",
      percent,
      message,
      label,
    } satisfies ExportWorkerResponse);
  };

  try {
    const blob = await runExportPipeline(
      file, segments, quality, progress,
      mutedSegments, audioOverlaysPCM, nativeAudioPCM
    );
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
  const preferenceOrder: VideoCodec[] = ["avc", "hevc", "vp9"];
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
  onProgress: (pct: number, msg: string) => void,
  mutedSegments: MutedSegment[] = [],
  audioOverlaysPCM: AudioOverlayPCM[] = [],
  nativeAudioPCM: DecodedPCM | null = null
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
  const hasNativeAudio = audioTrack !== null;
  const hasMuting = mutedSegments.length > 0;
  const hasOverlays = audioOverlaysPCM.length > 0;
  // We need audio if there's a native track OR if overlays need to be mixed in
  const needsAudio = hasNativeAudio || hasOverlays;
  // We can use fast passthrough (copy encoded packets) when there's no muting and no overlays
  const canPassthrough = hasNativeAudio && !hasMuting && !hasOverlays;

  console.log("[Worker Audio] audioTrack:", audioTrack ? "found" : "null");
  console.log("[Worker Audio] hasNativeAudio:", hasNativeAudio);
  console.log("[Worker Audio] hasMuting:", hasMuting, "hasOverlays:", hasOverlays);
  console.log("[Worker Audio] needsAudio:", needsAudio, "canPassthrough:", canPassthrough);

  // --- Audio source setup ---
  let encodedAudioSource: EncodedAudioPacketSource | null = null;
  let decodedAudioSource: AudioSampleSource | null = null;

  if (needsAudio && canPassthrough && audioTrack) {
    const decoderConfig = await audioTrack.getDecoderConfig();
    const rawCodec = decoderConfig?.codec?.split(".")[0] ?? "aac";
    const codecMap: Record<string, string> = { mp4a: "aac", mp3: "mp3", opus: "opus", vorbis: "vorbis", flac: "flac", ac3: "ac3", "ec-3": "eac3" };
    const audioCodec = (codecMap[rawCodec] ?? rawCodec) as AudioCodec;
    console.log(`[Worker Audio] Raw codec: "${decoderConfig?.codec}", mapped to: "${audioCodec}"`);
    encodedAudioSource = new EncodedAudioPacketSource(audioCodec);
    output.addVideoTrack(videoSource);
    output.addAudioTrack(encodedAudioSource);
    console.log("[Worker Audio] Using PASSTHROUGH mode with codec:", audioCodec);
  } else if (needsAudio) {
    decodedAudioSource = new AudioSampleSource({
      codec: "aac",
      bitrate: 128_000,
    });
    output.addVideoTrack(videoSource);
    output.addAudioTrack(decodedAudioSource);
    console.log("[Worker Audio] Using DECODE mode (muting/overlays present)");
  } else {
    output.addVideoTrack(videoSource);
    console.log("[Worker Audio] No audio processing needed");
  }

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

  // ─── Audio pass ───
  if (encodedAudioSource && audioTrack) {
    // PASSTHROUGH: copy encoded audio packets directly (no decode/re-encode)
    onProgress(82, "Copying audio…");
    console.log("[Worker Audio] Starting PASSTHROUGH audio copy...");
    try {
      const audioPacketSink = new EncodedPacketSink(audioTrack);
      let packetCount = 0;
      let isFirstPacket = true;

      for (const seg of segments) {
        // Get the first key packet at or before segment start
        const firstPacket = await audioPacketSink.getKeyPacket(seg.start);
        if (!firstPacket) {
          console.log(`[Worker Audio] No audio packets found for segment ${seg.start}-${seg.end}`);
          continue;
        }

        for await (const packet of audioPacketSink.packets(firstPacket)) {
          if (packet.timestamp > seg.end) break;
          if (packet.timestamp + packet.duration < seg.start) continue;

          // For the first packet, pass metadata so the muxer knows the codec config
          if (isFirstPacket) {
            const config = await audioTrack.getDecoderConfig();
            const meta: EncodedAudioChunkMetadata = {
              decoderConfig: config ? {
                codec: config.codec,
                sampleRate: config.sampleRate,
                numberOfChannels: config.numberOfChannels,
                description: config.description,
              } : undefined,
            };
            await encodedAudioSource.add(packet, meta);
            isFirstPacket = false;
          } else {
            await encodedAudioSource.add(packet);
          }
          packetCount++;
        }
      }
      console.log(`[Worker Audio] PASSTHROUGH done. ${packetCount} audio packets copied.`);
    } catch (err) {
      console.error("[Worker Audio] PASSTHROUGH audio copy FAILED:", err);
      throw err;
    }
    encodedAudioSource.close();
  } else if (decodedAudioSource) {
    // DECODE MODE: mix pre-decoded PCM from main thread
    onProgress(82, "Processing audio…");
    console.log("[Worker Audio] Starting PCM mixing mode...");
    try {
      let sourceAudioPCM = nativeAudioPCM;
      if (!sourceAudioPCM && hasNativeAudio && audioTrack) {
        onProgress(82, "Decoding source audio in worker…");
        sourceAudioPCM = await decodeNativeAudioTrackToPCM(audioTrack, (msg) => {
          console.log("[Worker Audio]", msg);
        });
      }

      if (hasNativeAudio && !sourceAudioPCM) {
        throw new Error("Could not decode the source audio for the modified export.");
      }

      await processAudioPCM(
        sourceAudioPCM,
        segments,
        decodedAudioSource,
        mutedSegments,
        audioOverlaysPCM,
        totalDuration,
        (msg) => {
          console.log("[Worker Audio]", msg);
          onProgress(82, msg);
        }
      );
      console.log("[Worker Audio] PCM mixing completed successfully");
    } catch (err) {
      console.error("[Worker Audio] PCM mixing FAILED:", err);
      onProgress(82, "Audio processing failed: " + String(err));
      throw err;
    }
    decodedAudioSource.close();
  } else {
    console.log("[Worker Audio] No audio to process");
  }

  onProgress(95, "Finalizing MP4…");
  await output.finalize();
  input[Symbol.dispose]();

  const buffer = target.buffer;
  if (!buffer) throw new Error("Muxer produced no output buffer.");

  return new Blob([buffer], { type: "video/mp4" });
}

/**
 * Returns true if the absolute time falls inside any muted segment.
 */
function isSampleMuted(
  absSec: number,
  mutedSegments: MutedSegment[]
): boolean {
  return mutedSegments.some((m) => absSec >= m.start && absSec < m.end);
}

async function decodeNativeAudioTrackToPCM(
  audioTrack: InputAudioTrack,
  onLog?: (msg: string) => void
): Promise<DecodedPCM | null> {
  const sink = new AudioSampleSink(audioTrack);
  const chunks: {
    timestamp: number;
    channels: Float32Array[];
    frameCount: number;
  }[] = [];

  let sampleRate = 0;
  let numberOfChannels = 0;
  let totalFrames = 0;
  let sampleCount = 0;

  for await (const sample of sink.samples()) {
    try {
      if (!sampleRate) sampleRate = sample.sampleRate;
      if (!numberOfChannels) numberOfChannels = sample.numberOfChannels;

      if (
        sample.sampleRate !== sampleRate ||
        sample.numberOfChannels !== numberOfChannels
      ) {
        throw new Error("Source audio parameters changed during decode.");
      }

      const channels: Float32Array[] = [];
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = new Float32Array(sample.numberOfFrames);
        sample.copyTo(channelData, {
          planeIndex: ch,
          format: "f32-planar",
        });
        channels.push(channelData);
      }

      const startFrame = Math.round(sample.timestamp * sampleRate);
      const endFrame = startFrame + sample.numberOfFrames;
      if (endFrame > totalFrames) totalFrames = endFrame;

      chunks.push({
        timestamp: sample.timestamp,
        channels,
        frameCount: sample.numberOfFrames,
      });
      sampleCount++;
    } finally {
      sample.close();
    }
  }

  if (!sampleRate || !numberOfChannels || !totalFrames) {
    onLog?.("Worker source audio decode produced no samples.");
    return null;
  }

  const channels = Array.from(
    { length: numberOfChannels },
    () => new Float32Array(totalFrames)
  );

  for (const chunk of chunks) {
    const startFrame = Math.max(0, Math.round(chunk.timestamp * sampleRate));
    const sourceOffset =
      chunk.timestamp < 0
        ? Math.min(chunk.frameCount, -Math.round(chunk.timestamp * sampleRate))
        : 0;
    const writableFrames = Math.min(
      chunk.frameCount - sourceOffset,
      totalFrames - startFrame
    );
    if (writableFrames <= 0) continue;

    for (let ch = 0; ch < numberOfChannels; ch++) {
      channels[ch].set(
        chunk.channels[ch].subarray(sourceOffset, sourceOffset + writableFrames),
        startFrame
      );
    }
  }

  onLog?.(
    `Worker decoded source audio: ${(totalFrames / sampleRate).toFixed(2)}s, ${numberOfChannels}ch, ${sampleCount} samples`
  );

  return {
    channels,
    sampleRate,
    numberOfChannels,
    length: totalFrames,
    duration: totalFrames / sampleRate,
  };
}

/**
 * Process audio using pre-decoded PCM data from the main thread.
 * No AudioBuffer or OfflineAudioContext needed — works purely with Float32Arrays
 * and feeds real AudioSample instances to Mediabunny's AudioSampleSource.
 */
async function processAudioPCM(
  nativePCM: DecodedPCM | null,
  segments: { start: number; end: number }[],
  audioSource: AudioSampleSource,
  mutedSegments: MutedSegment[] = [],
  overlaysPCM: AudioOverlayPCM[] = [],
  totalDuration = 0,
  onLog?: (msg: string) => void
): Promise<void> {
  console.log("[Worker Audio PCM] Entry.");
  console.log("[Worker Audio PCM] nativePCM:", nativePCM ? `${nativePCM.duration.toFixed(2)}s, ${nativePCM.numberOfChannels}ch` : "null");
  console.log("[Worker Audio PCM] segments:", JSON.stringify(segments));
  console.log("[Worker Audio PCM] mutedSegments:", JSON.stringify(mutedSegments));
  console.log("[Worker Audio PCM] overlaysPCM count:", overlaysPCM.length);
  onLog?.(`Mixing audio — ${totalDuration.toFixed(1)}s total`);

  const SAMPLE_RATE = nativePCM?.sampleRate ?? 44100;
  const NUM_CHANNELS = 2;
  const CHUNK_SECONDS = 2; // Process in 2-second chunks
  let totalBuffersAdded = 0;
  let currentExportTime = 0;

  for (const seg of segments) {
    console.log(`[Worker Audio PCM] Segment: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s`);
    let t = seg.start;

    while (t < seg.end) {
      const chunkEnd = Math.min(t + CHUNK_SECONDS, seg.end);
      const chunkDur = chunkEnd - t;
      if (chunkDur <= 0) { t = chunkEnd; continue; }

      const chunkSamples = Math.max(1, Math.round(chunkDur * SAMPLE_RATE));

      // Build channel data for this chunk
      const channels: Float32Array[] = [];
      for (let ch = 0; ch < NUM_CHANNELS; ch++) {
        channels.push(new Float32Array(chunkSamples));
      }

      // 1) Copy native audio into the chunk
      if (nativePCM) {
        const srcStart = Math.floor(t * SAMPLE_RATE);
        const srcNumCh = Math.min(nativePCM.numberOfChannels, NUM_CHANNELS);
        for (let ch = 0; ch < srcNumCh; ch++) {
          const src = nativePCM.channels[ch];
          const dst = channels[ch];
          for (let i = 0; i < chunkSamples; i++) {
            const srcIdx = srcStart + i;
            if (srcIdx >= 0 && srcIdx < src.length) {
              dst[i] = src[srcIdx];
            }
          }
        }
      }

      // 2) Apply muting
      if (mutedSegments.length > 0) {
        for (let i = 0; i < chunkSamples; i++) {
          const absSec = t + i / SAMPLE_RATE;
          if (isSampleMuted(absSec, mutedSegments)) {
            for (let ch = 0; ch < NUM_CHANNELS; ch++) {
              channels[ch][i] = 0;
            }
          }
        }
      }

      // 3) Mix in overlay audio
      for (const ov of overlaysPCM) {
        const chunkAbsEnd = t + chunkDur;
        if (ov.videoEnd <= t || ov.videoStart >= chunkAbsEnd) continue;

        const ovPcm = ov.pcm;
        const ovNumCh = Math.min(ovPcm.numberOfChannels, NUM_CHANNELS);

        for (let ch = 0; ch < NUM_CHANNELS; ch++) {
          const dst = channels[ch];
          const ovSrc = ch < ovNumCh ? ovPcm.channels[ch] : ovPcm.channels[0];

          for (let i = 0; i < chunkSamples; i++) {
            const absSec = t + i / SAMPLE_RATE;
            if (absSec < ov.videoStart || absSec >= ov.videoEnd) continue;

            const ovIdx = Math.floor((absSec - ov.videoStart) * ovPcm.sampleRate);
            if (ovIdx < 0 || ovIdx >= ovSrc.length) continue;

            dst[i] = Math.max(-1, Math.min(1, dst[i] + ovSrc[ovIdx] * ov.volume));
          }
        }
      }

      // 4) Feed the mixed PCM to Mediabunny as planar f32 AudioSample data
      const planarData = new Float32Array(NUM_CHANNELS * chunkSamples);
      for (let ch = 0; ch < NUM_CHANNELS; ch++) {
        planarData.set(channels[ch], ch * chunkSamples);
      }

      const audioSample = new AudioSample({
        data: planarData,
        format: "f32-planar",
        sampleRate: SAMPLE_RATE,
        numberOfChannels: NUM_CHANNELS,
        timestamp: currentExportTime,
      });
      const audioSampleDuration = audioSample.duration;

      try {
        await audioSource.add(audioSample);
      } finally {
        audioSample.close();
      }
      totalBuffersAdded++;
      currentExportTime += audioSampleDuration;
      t = chunkEnd;
    }

    console.log(`[Worker Audio PCM] Segment ${seg.start.toFixed(2)}-${seg.end.toFixed(2)} done`);
  }

  console.log(`[Worker Audio PCM] DONE. Buffers: ${totalBuffersAdded}, duration: ${currentExportTime.toFixed(2)}s`);
}


export {};
