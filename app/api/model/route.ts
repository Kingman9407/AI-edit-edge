import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const modelUrl = process.env.MODEL_URL || "https://huggingface.co/Kingman9407/hornet/resolve/main/model.onnx";

  try {
    const fetchHeaders = new Headers();
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
    if (hfToken) {
      fetchHeaders.set("Authorization", `Bearer ${hfToken}`);
    }

    const response = await fetch(modelUrl, {
      headers: fetchHeaders,
    });

    if (!response.ok) {
      console.error(`[API Model] Hugging Face fetch error: ${response.status} ${response.statusText}`);
      return new NextResponse(`Failed to fetch model from Hugging Face: ${response.status} ${response.statusText}`, { status: response.status });
    }

    if (!response.body) {
      console.error("[API Model] Hugging Face returned response without a body stream.");
      return new NextResponse("Hugging Face returned empty response body", { status: 500 });
    }

    // Stream the model binary back to the client with appropriate headers
    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");

    const contentLen = response.headers.get("content-length");
    if (contentLen && contentLen !== "null") {
      headers.set("Content-Length", contentLen);
    } else {
      // Fallback content length for SmolLM2 ONNX model (166,009,881 bytes)
      headers.set("Content-Length", "166009881");
    }

    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[API Model] Exception occurred while fetching model from Hugging Face:", error);
    return new NextResponse(`Error fetching model: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}



