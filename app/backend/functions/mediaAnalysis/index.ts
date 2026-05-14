import { encodeWavDataUrl } from "@/app/backend/functions/audio";

export type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type AudioAnalysisResult = {
  segments: AudioSegment[];
  status: "done" | "no-audio" | "error";
  error?: string | null;
};

const AUDIO_CHUNK_SECONDS = 20;
const AUDIO_CONCURRENCY = 3;

export async function getVideoMetadata(file: File) {
  return new Promise<{ duration: number; width: number; height: number }>(
    (resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        video.load();
      };

      video.addEventListener("loadedmetadata", () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        resolve({
          duration,
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
        });
        cleanup();
      });

      video.addEventListener("error", () => {
        cleanup();
        reject(new Error("Failed to load video metadata"));
      });

      video.src = url;
    }
  );
}

export async function analyzeAudioFile(
  file: File,
  options?: {
    onUsage?: (usage: TokenUsage) => void;
  }
): Promise<AudioAnalysisResult> {
  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    let decoded: AudioBuffer;
    try {
      decoded = await audioContext.decodeAudioData(arrayBuffer);
    } catch {
      return { segments: [], status: "no-audio" };
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

    const sampleRate = rendered.sampleRate;
    const channelData = rendered.getChannelData(0);
    if (!channelData.length) {
      return { segments: [], status: "no-audio" };
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
      return { segments: [], status: "done" };
    }

    const segments: AudioSegment[] = [];
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

        const payload = {
          audio: audioDataUrl.slice(0, 50) + "...",
          startTime,
          endTime,
        };
        console.log("Transcribe Request:", payload);

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
        console.log("Transcribe Response:", data);
        if (!res.ok) {
          throw new Error(data?.error || "Audio transcription failed");
        }

        if (data?.usage && options?.onUsage) {
          options.onUsage(data.usage);
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
        segments.push({
          start: startTime,
          end: endTime,
          transcript,
          category,
        });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
    segments.sort((a, b) => a.start - b.start);
    return { segments, status: "done" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio analysis failed";
    return { segments: [], status: "error", error: message };
  } finally {
    audioContext.close();
  }
}
