type VideoRecognizeRequest = {
  image?: string;
  time?: number;
};

export async function POST(req: Request) {
  const { image } = (await req.json()) as VideoRecognizeRequest;

  if (!image || typeof image !== "string") {
    return Response.json({ error: "Missing image data" }, { status: 400 });
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Describe the key visual elements, actions, and any on-screen text in one short sentence.",
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        max_tokens: 128,
        temperature: 0.2,
        top_p: 0.9,
      }),
    }
  );

  const raw = await response.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const errorMessage =
      data?.error?.message || data?.error || raw || "Video recognition failed";
    return Response.json({ error: errorMessage }, { status: response.status });
  }
  if (!data) {
    return Response.json(
      { error: "Invalid response from recognition model" },
      { status: 502 }
    );
  }

  const description = data?.choices?.[0]?.message?.content ?? "";
  return Response.json(
    {
      description,
      usage: data?.usage ?? null,
    },
    { status: 200 }
  );
}
