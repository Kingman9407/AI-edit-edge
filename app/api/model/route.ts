import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_4dlZfN9MYOUoEHwI_Fvwip7ZakOE2milIVW6SDnFwM6XGtg";

  const modelUrl = "https://4dlzfn9myouoehwi.private.blob.vercel-storage.com/models/model.onnx";

  try {
    const response = await fetch(modelUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`[API Model] Vercel Blob error status: ${response.status} ${response.statusText}`);
      return new NextResponse(`Failed to fetch model from storage: ${response.status} ${response.statusText}`, { status: response.status });
    }

    if (!response.body) {
      console.error("[API Model] Vercel Blob returned response without a body stream.");
      return new NextResponse("Vercel Blob returned empty response body", { status: 500 });
    }

    // Stream the response back to the client
    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");

    const contentLen = response.headers.get("content-length");
    if (contentLen && contentLen !== "null") {
      headers.set("Content-Length", contentLen);
    }

    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[API Model] Exception occurred while fetching model:", error);
    return new NextResponse(`Error fetching model: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}

