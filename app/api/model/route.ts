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
      return new NextResponse(`Failed to fetch model from storage: ${response.status} ${response.statusText}`, { status: response.status });
    }

    // Stream the response back to the client
    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Content-Length", response.headers.get("content-length") || "");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new NextResponse(`Error fetching model: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}
