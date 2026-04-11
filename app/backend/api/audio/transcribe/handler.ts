type TranscribeRequest = {
  audio?: string;
  startTime?: number;
  endTime?: number;
};

type TranscribeResult = {
  transcript: string;
  category: "speech" | "music" | "sfx";
};

export const runtime = "nodejs";

const NON_SPEECH_TOKENS = new Set([
  "ta",
  "da",
  "la",
  "na",
  "ra",
  "ha",
  "ah",
  "oh",
  "uh",
  "mm",
  "hmm",
  "yo",
  "yeah",
  "hey",
]);

function normalizeTranscript(value: string) {
  return value
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
}

function isLikelyNonSpeech(transcript: string) {
  const cleaned = transcript.toLowerCase().replace(/[^a-z\s]/g, " ").trim();
  if (!cleaned) return true;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const unique = new Set(tokens);
  const uniqueRatio = unique.size / tokens.length;
  const counts = new Map<string, number>();
  let maxCount = 0;
  tokens.forEach((token) => {
    const next = (counts.get(token) ?? 0) + 1;
    counts.set(token, next);
    if (next > maxCount) maxCount = next;
  });
  const topRatio = maxCount / tokens.length;
  const allNonSpeech = tokens.every((token) => NON_SPEECH_TOKENS.has(token));
  if (allNonSpeech && tokens.length >= 4) return true;
  if (tokens.length >= 6 && uniqueRatio < 0.25) return true;
  if (tokens.length >= 6 && topRatio >= 0.6) return true;
  return false;
}

function normalizeCategory(value: unknown): TranscribeResult["category"] | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized === "speech" || normalized === "music" || normalized === "sfx") {
    return normalized;
  }
  return null;
}

function safeJsonParse(value: string): TranscribeResult | null {
  const cleaned = normalizeTranscript(value);

  try {
    const parsed = JSON.parse(cleaned) as any;
    const category = normalizeCategory(parsed?.category);
    if (typeof parsed?.transcript === "string" && category) {
      return { transcript: parsed.transcript, category };
    }
    if (typeof parsed?.transcript === "string" && typeof parsed?.isMusic === "boolean") {
      return {
        transcript: parsed.transcript,
        category: parsed.isMusic ? "music" : "speech",
      };
    }
  } catch {
    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as any;
        const category = normalizeCategory(parsed?.category);
        if (typeof parsed?.transcript === "string" && category) {
          return { transcript: parsed.transcript, category };
        }
        if (
          typeof parsed?.transcript === "string" &&
          typeof parsed?.isMusic === "boolean"
        ) {
          return {
            transcript: parsed.transcript,
            category: parsed.isMusic ? "music" : "speech",
          };
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const { audio, startTime, endTime } = (await req.json()) as TranscribeRequest;

  if (!audio || typeof audio !== "string") {
    return Response.json({ error: "Missing audio data" }, { status: 400 });
  }

  const base64Audio = audio.includes("base64,")
    ? audio.split("base64,")[1]
    : audio;

  const prompt =
    "Transcribe the audio segment. Return JSON only with keys " +
    '"transcript" (string) and "category" (string, one of "speech", "music", "sfx"). ' +
    'If speech exists, set category "speech" and include the transcript with punctuation. ' +
    'If it is music, set category "music" and keep "transcript" empty. ' +
    'If it is non-speech background sounds/SFX (footsteps, UI beeps, gunshots, ambiance), set category "sfx" and keep "transcript" empty. ' +
    "Do not include extra text.";

  const callNvidia = async (mode: "input_audio" | "tag") => {
    const messages =
      mode === "input_audio"
        ? [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: "wav",
                  },
                },
              ],
            },
          ]
        : [
            {
              role: "user",
              content: `${prompt}\n<audio src="${audio}" />`,
            },
          ];

    const response = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "microsoft/phi-4-multimodal-instruct",
          messages,
          max_tokens: 300,
          temperature: 0.1,
          top_p: 0.9,
        }),
      }
    );

    const raw = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    return { response, raw, data };
  };

  let result: Awaited<ReturnType<typeof callNvidia>>;
  try {
    result = await callNvidia("input_audio");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Audio request failed" },
      { status: 500 }
    );
  }

  if (!result.response.ok) {
    result = await callNvidia("tag");
  }

  if (!result.response.ok) {
    const data = result.data;
    let errorMessage =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      result.raw?.slice(0, 200) ||
      "Audio transcription failed";
    if (typeof errorMessage === "string" && errorMessage.includes("DEGRADED")) {
      errorMessage =
        "Speech model is temporarily unavailable. Please try again shortly.";
    }
    return Response.json(
      { error: errorMessage },
      { status: result.response.status }
    );
  }

  const content = result.data?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(content);
  const fallbackTranscript = normalizeTranscript(content);
  let transcript = parsed?.transcript ?? fallbackTranscript;
  let category: TranscribeResult["category"] =
    parsed?.category ?? (transcript ? "speech" : "sfx");

  if (transcript && isLikelyNonSpeech(transcript)) {
    transcript = "";
    category = "sfx";
  }

  return Response.json(
    {
      transcript,
      category,
      startTime,
      endTime,
      usage: result.data?.usage ?? null,
    },
    { status: 200 }
  );
}
