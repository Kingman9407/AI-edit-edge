type Segment = {
  start: number;
  end: number;
  reason?: string | null;
};

type OrderRequest = {
  segments?: Segment[];
  prompt?: string;
};

type OrderResponse = {
  order: number[];
};

export const runtime = "nodejs";

const MODEL_DEFAULT = "openai/gpt-oss-120b";

const parseJson = (value: string): OrderResponse | null => {
  try {
    const parsed = JSON.parse(value) as Partial<OrderResponse> | null;
    if (!parsed || !Array.isArray(parsed.order)) return null;
    return { order: parsed.order as number[] };
  } catch {
    return null;
  }
};

const buildPrompt = (segments: Segment[], prompt?: string) => {
  const lines = segments.map((segment, index) => {
    const reason = segment.reason ? ` | note: ${segment.reason}` : "";
    return `${index + 1}. ${segment.start.toFixed(2)}-${segment.end.toFixed(2)}${reason}`;
  });

  const userPrompt = prompt?.trim()
    ? `User preference: ${prompt.trim()}`
    : "User preference: Arrange for best flow and clarity.";

  return [
    "You are arranging video clips into the best narrative order.",
    userPrompt,
    "Return ONLY JSON with this schema: {\"order\": [1,2,3]}.",
    "Use 1-based indices from the provided list.",
    "Do not include extra keys or text.",
    "Clips:",
    ...lines,
  ].join("\n");
};

const sanitizeOrder = (order: number[], count: number): number[] => {
  const seen = new Set<number>();
  const cleaned: number[] = [];
  order.forEach((value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const index = Math.round(num);
    if (index < 1 || index > count) return;
    if (seen.has(index)) return;
    seen.add(index);
    cleaned.push(index);
  });

  if (cleaned.length < count) {
    for (let i = 1; i <= count; i += 1) {
      if (!seen.has(i)) cleaned.push(i);
    }
  }

  return cleaned;
};

const requestOrder = async (
  segments: Segment[],
  prompt?: string
): Promise<number[] | null> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_CHAT_MODEL ?? MODEL_DEFAULT;
  const attempts: { temperature: number; top_p: number; extraSystem?: string }[] = [
    { temperature: 0.2, top_p: 0.8 },
    {
      temperature: 0,
      top_p: 0.1,
      extraSystem:
        "Fix the JSON. Return ONLY {\"order\": [1,2,3]} with 1-based indices.",
    },
    {
      temperature: 0,
      top_p: 0.1,
      extraSystem:
        "Final attempt. Output ONLY JSON matching {\"order\": [1,2,3]}.",
    },
  ];

  let lastContent = "";

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    const systemContent = attempt.extraSystem
      ? `${attempt.extraSystem}\nInvalid response:\n${lastContent.slice(0, 1200) || "<empty>"}`
      : "Return ONLY JSON with {\"order\": [1,2,3]} and nothing else.";
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: buildPrompt(segments, prompt) },
          ],
          max_tokens: 300,
          temperature: attempt.temperature,
          top_p: attempt.top_p,
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

    if (!response.ok) {
      lastContent = data?.error?.message || raw;
      continue;
    }

    const content = data?.choices?.[0]?.message?.content ?? "";
    lastContent = content;
    const parsed = parseJson(content);
    if (parsed?.order?.length) {
      return sanitizeOrder(parsed.order, segments.length);
    }
  }

  return null;
};

export async function POST(req: Request) {
  let body: OrderRequest | null = null;
  try {
    body = (await req.json()) as OrderRequest;
  } catch {
    body = null;
  }

  if (!body?.segments || !Array.isArray(body.segments) || body.segments.length < 2) {
    return Response.json({ order: [] }, { status: 200 });
  }

  const segments = body.segments
    .map((segment) => ({
      start: Number(segment.start),
      end: Number(segment.end),
      reason: segment.reason ?? null,
    }))
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end));

  if (segments.length < 2) {
    return Response.json({ order: [] }, { status: 200 });
  }

  const order = await requestOrder(segments, body.prompt);
  return Response.json({ order: order ?? [] }, { status: 200 });
}
