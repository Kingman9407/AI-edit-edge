import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const modelUrl = process.env.MODEL_URL || "https://huggingface.co/Kingman9407/hornet/resolve/main/model.onnx";

  console.log(`[HuggingFace] Starting model fetch from: ${modelUrl}`);

  try {
    const fetchHeaders = new Headers();
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;

    if (hfToken) {
      fetchHeaders.set("Authorization", `Bearer ${hfToken}`);
      console.log("[HuggingFace] Auth token found and attached to request.");
    } else {
      console.error(
        "[HuggingFace] ⚠️  No HF_TOKEN or HUGGINGFACE_TOKEN found in environment. " +
        "If the model repo is private, the request will fail with 401/403."
      );
    }

    let response: Response;
    try {
      response = await fetch(modelUrl, { headers: fetchHeaders });
    } catch (networkError) {
      console.error(
        "[HuggingFace] ❌ Network error — could not reach HuggingFace Hub.",
        "URL:", modelUrl,
        "Error:", networkError
      );
      return new NextResponse(
        `Network error reaching HuggingFace: ${networkError instanceof Error ? networkError.message : networkError}`,
        { status: 502 }
      );
    }

    console.log(
      `[HuggingFace] Response received — HTTP ${response.status} ${response.statusText}`,
      `| URL: ${response.url || modelUrl}`
    );

    if (response.status === 401) {
      console.error(
        "[HuggingFace] ❌ 401 Unauthorized — HF token is missing, invalid, or expired.",
        "Ensure HF_TOKEN is set in .env.local and the token has read access."
      );
      return new NextResponse("HuggingFace: Unauthorized (401) — check HF_TOKEN.", { status: 401 });
    }

    if (response.status === 403) {
      console.error(
        "[HuggingFace] ❌ 403 Forbidden — token does not have access to this model repo.",
        "Repo:", modelUrl,
        "Make sure the token has 'read' scope for the repo and the repo exists."
      );
      return new NextResponse("HuggingFace: Forbidden (403) — token lacks access to the model repo.", { status: 403 });
    }

    if (response.status === 404) {
      console.error(
        "[HuggingFace] ❌ 404 Not Found — model file does not exist at the specified URL.",
        "URL:", modelUrl,
        "Check MODEL_URL in .env.local."
      );
      return new NextResponse("HuggingFace: Model file not found (404). Check MODEL_URL.", { status: 404 });
    }

    if (!response.ok) {
      console.error(
        `[HuggingFace] ❌ Unexpected HTTP error ${response.status} ${response.statusText}.`,
        "URL:", modelUrl
      );
      return new NextResponse(
        `Failed to fetch model from HuggingFace: ${response.status} ${response.statusText}`,
        { status: response.status }
      );
    }

    if (!response.body) {
      console.error(
        "[HuggingFace] ❌ Response was OK but body stream is null — cannot stream model.",
        "Status:", response.status,
        "URL:", modelUrl
      );
      return new NextResponse("HuggingFace returned empty response body.", { status: 500 });
    }

    // Stream the model binary back to the client with appropriate headers
    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");

    const contentLen = response.headers.get("content-length");
    if (contentLen && contentLen !== "null") {
      headers.set("Content-Length", contentLen);
      console.log(`[HuggingFace] Streaming model — Content-Length: ${contentLen} bytes.`);
    } else {
      // Fallback content length for the ONNX model
      headers.set("Content-Length", "166009881");
      console.log("[HuggingFace] Content-Length header missing from HuggingFace response — using fallback (166009881 bytes).");
    }

    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    console.log("[HuggingFace] ✅ Model stream started successfully.");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(
      "[HuggingFace] ❌ Unhandled exception while fetching model.",
      "Error:", error instanceof Error ? error.message : error,
      "Stack:", error instanceof Error ? error.stack : undefined
    );
    return new NextResponse(
      `Error fetching model: ${error instanceof Error ? error.message : error}`,
      { status: 500 }
    );
  }
}



