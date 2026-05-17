/// <reference lib="webworker" />

/**
 * export.worker.ts
 *
 * Off-main-thread WebCodecs export pipeline using Mediabunny v1.44.2.
 *
 * Architecture:
 *  - Demux source with Mediabunny Input + EncodedPacketSink
 *  - Video passthrough: EncodedVideoPacketSource (no decode/re-encode, works on ALL browsers/mobile)
 *    - Timestamps are remapped per-segment via packet.clone({ timestamp })
 *  - Audio passthrough: EncodedAudioPacketSource (no decode, fastest)
 *  - Audio mixing: pre-decoded PCM from main thread → AudioSampleSource
 *  - Mux with Mediabunny Output → Mp4OutputFormat → BufferTarget
 *  - Memory: frame.close() immediately after use; backpressure via encoder queue monitoring
 *
 * NOTE: We deliberately avoid VideoDecoder/VideoEncoder/OffscreenCanvas because they are
 * unreliable inside Web Workers on mobile browsers (especially Safari/iOS), causing
 * the video track to be silently omitted from the output file.
 */

import {
  Input,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  BlobSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  MP4,
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

  const videoDecoderConfig = await videoTrack.getDecoderConfig();
  if (!videoDecoderConfig) {
    throw new Error("Cannot determine decoder configuration for video track.");
  }

  // Determine the source video codec for passthrough
  const sourceVideoCodec = videoTrack.codec as VideoCodec;
  console.log("[Worker Video] Source video codec:", sourceVideoCodec);
  console.log("[Worker Video] Using PASSTHROUGH mode (no decode/encode, mobile-safe)");

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  // ── Video: Passthrough via EncodedVideoPacketSource ──
  // This avoids VideoDecoder/VideoEncoder/OffscreenCanvas which are broken in
  // Web Workers on mobile browsers (Safari/iOS, some Android Chrome versions).
  const videoPacketSource = new EncodedVideoPacketSource(sourceVideoCodec);

  const audioTrack = await input.getPrimaryAudioTrack();
  const hasNativeAudio = audioTrack !== null;
  const hasMuting = mutedSegments.length > 0;
  const hasOverlays = audioOverlaysPCM.length > 0;
  const needsAudio = hasNativeAudio || hasOverlays;
  const canPassthrough = hasNativeAudio && !hasMuting && !hasOverlays;

  console.log("[Worker Audio] audioTrack:", audioTrack ? "found" : "null");
  console.log("[Worker Audio] hasNativeAudio:", hasNativeAudio);
  console.log("[Worker Audio] hasMuting:", hasMuting, "hasOverlays:", hasOverlays);
  console.log("[Worker Audio] needsAudio:", needsAudio, "canPassthrough:", canPassthrough);

  // --- Audio source setup ---
  let encodedAudioSource: EncodedAudioPacketSource | null = null;
  let decodedAudioSource: AudioSampleSource | null = null;

  if (needsAudio && canPassthrough && audioTrack) {
    const audioDec = await audioTrack.getDecoderConfig();
    const rawCodec = audioDec?.codec?.split(".")[0] ?? "aac";
    const codecMap: Record<string, string> = { mp4a: "aac", mp3: "mp3", opus: "opus", vorbis: "vorbis", flac: "flac", ac3: "ac3", "ec-3": "eac3" };
    const audioCodec = (codecMap[rawCodec] ?? rawCodec) as AudioCodec;
    console.log(`[Worker Audio] Raw codec: "${audioDec?.codec}", mapped to: "${audioCodec}"`);
    encodedAudioSource = new EncodedAudioPacketSource(audioCodec);
    output.addVideoTrack(videoPacketSource);
    output.addAudioTrack(encodedAudioSource);
    console.log("[Worker Audio] Using PASSTHROUGH mode with codec:", audioCodec);
  } else if (needsAudio) {
    decodedAudioSource = new AudioSampleSource({
      codec: "aac",
      bitrate: 128_000,
    });
    output.addVideoTrack(videoPacketSource);
    output.addAudioTrack(decodedAudioSource);
    console.log("[Worker Audio] Using DECODE mode (muting/overlays present)");
  } else {
    output.addVideoTrack(videoPacketSource);
    console.log("[Worker Audio] No audio processing needed");
  }

  await output.start();

  onProgress(10, "Starting video passthrough…");

  // ─── Video pass (packet passthrough with timestamp remapping) ───
  const totalDuration = segments.reduce((s, seg) => s + seg.end - seg.start, 0);
  let timeOffset = 0; // running export timestamp (seconds)
  let packetsEncoded = 0;
  let isFirstVideoPacket = true;

  const videoPacketSink = new EncodedPacketSink(videoTrack);

  for (const seg of segments) {
    const segDuration = seg.end - seg.start;

    console.log(`[Worker Video] Segment: ${seg.start.toFixed(3)}s – ${seg.end.toFixed(3)}s`);

    // Seek to the nearest key frame at or before seg.start
    const keyPacket = await videoPacketSink.getKeyPacket(seg.start);
    if (!keyPacket) {
      console.warn(`[Worker Video] No key packet found for segment ${seg.start}-${seg.end}, skipping`);
      timeOffset += segDuration;
      continue;
    }

    for await (const packet of videoPacketSink.packets(keyPacket)) {
      // Stop when we've passed the segment end
      if (packet.timestamp > seg.end) break;

      // Skip pre-roll packets (before the actual segment start)
      // These are needed by the decoder for context but shouldn't be output
      if (packet.timestamp + packet.duration <= seg.start) continue;

      // Remap timestamp: shift so this segment starts at timeOffset
      const remappedTs = packet.timestamp - seg.start + timeOffset;

      // Clone the packet with the new timestamp (keeps all data/type/duration intact)
      const remappedPacket = packet.clone({ timestamp: remappedTs });

      if (isFirstVideoPacket) {
        // Pass decoder config metadata on the first packet so the muxer knows the codec
        const meta: EncodedVideoChunkMetadata = {
          decoderConfig: videoDecoderConfig ? {
            codec: videoDecoderConfig.codec,
            codedWidth: videoDecoderConfig.codedWidth,
            codedHeight: videoDecoderConfig.codedHeight,
            description: videoDecoderConfig.description,
            colorSpace: videoDecoderConfig.colorSpace,
          } : undefined,
        };
        await videoPacketSource.add(remappedPacket, meta);
        isFirstVideoPacket = false;
      } else {
        await videoPacketSource.add(remappedPacket);
      }

      packetsEncoded++;

      // Report progress based on position within segment
      if (packet.timestamp >= seg.start) {
        const withinSeg = Math.min((packet.timestamp - seg.start) / segDuration, 1);
        const overallPct = (timeOffset + withinSeg * segDuration) / totalDuration;
        onProgress(Math.round(10 + overallPct * 70), `Copying video… ${packetsEncoded} packets`);
      }
    }

    timeOffset += segDuration;
    console.log(`[Worker Video] Segment done. Total packets so far: ${packetsEncoded}`);
  }

  console.log(`[Worker Video] PASSTHROUGH done. ${packetsEncoded} video packets copied.`);
  videoPacketSource.close();

  // ─── Audio pass ───
  if (encodedAudioSource && audioTrack) {
    onProgress(82, "Copying audio…");
    console.log("[Worker Audio] Starting PASSTHROUGH audio copy...");
    try {
      const audioPacketSink = new EncodedPacketSink(audioTrack);
      let packetCount = 0;
      let isFirstAudioPacket = true;

      for (const seg of segments) {
        const firstPacket = await audioPacketSink.getKeyPacket(seg.start);
        if (!firstPacket) {
          console.log(`[Worker Audio] No audio packets found for segment ${seg.start}-${seg.end}`);
          continue;
        }

        for await (const packet of audioPacketSink.packets(firstPacket)) {
          if (packet.timestamp > seg.end) break;
          if (packet.timestamp + packet.duration < seg.start) continue;

          if (isFirstAudioPacket) {
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
            isFirstAudioPacket = false;
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
  const CHUNK_SECONDS = 2;
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

      const channels: Float32Array[] = [];
      for (let ch = 0; ch < NUM_CHANNELS; ch++) {
        channels.push(new Float32Array(chunkSamples));
      }

      // 1) Copy native audio
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

      // 4) Feed mixed PCM to Mediabunny
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


export { };
