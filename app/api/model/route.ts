import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper function to extract Google Drive file ID
function extractFileId(urlOrId: string): string {
  if (!urlOrId) return "";
  const driveUrlRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const ucUrlRegex = /id=([a-zA-Z0-9_-]+)/;
  
  const driveMatch = urlOrId.match(driveUrlRegex);
  if (driveMatch) return driveMatch[1];
  
  const ucMatch = urlOrId.match(ucUrlRegex);
  if (ucMatch) return ucMatch[1];
  
  return urlOrId.trim();
}

export async function GET() {
  const driveUrl = process.env.GOOGLE_DRIVE_MODEL_URL || "https://drive.google.com/file/d/15Ga6e3PcCFXyPwH3seebDRouNg6r35bG/view?usp=sharing";
  const fileId = extractFileId(driveUrl);

  try {
    if (!fileId) {
      throw new Error("Invalid Google Drive URL or File ID configuration.");
    }

    const initialUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
    
    // Step 1: Initial request to Google Drive download link
    let response = await fetch(initialUrl);

    if (!response.ok) {
      console.error(`[API Model] Google Drive initial fetch error: ${response.status} ${response.statusText}`);
      return new NextResponse(`Failed to fetch model from Google Drive: ${response.status} ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "";

    // Step 2: Handle Google's large file virus warning page if it is returned
    if (contentType.includes("text/html")) {
      const html = await response.text();
      
      // Attempt to extract the confirm token from the warning page
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
      let confirmToken = confirmMatch ? confirmMatch[1] : null;

      if (!confirmToken) {
        const inputMatch = html.match(/name="confirm"\s+value="([a-zA-Z0-9_-]+)"/) ||
                           html.match(/value="([a-zA-Z0-9_-]+)"\s+name="confirm"/);
        confirmToken = inputMatch ? inputMatch[1] : null;
      }

      if (confirmToken) {
        // Extract the download warning cookie to authenticate the confirm request
        const setCookieHeader = response.headers.get("set-cookie") || "";
        const cookieMatch = setCookieHeader.match(/download_warning_[^=]+=[^;]+/i);
        const cookie = cookieMatch ? cookieMatch[0] : "";

        const downloadUrl = `https://docs.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}`;
        const headers: Record<string, string> = {};
        if (cookie) {
          headers["Cookie"] = cookie;
        }

        // Final request with the confirmation token and the required warning cookie
        response = await fetch(downloadUrl, { headers });

        if (!response.ok) {
          console.error(`[API Model] Google Drive final download error: ${response.status} ${response.statusText}`);
          return new NextResponse(`Failed to download model after bypass: ${response.status} ${response.statusText}`, { status: response.status });
        }

        const finalContentType = response.headers.get("content-type") || "";
        if (finalContentType.includes("text/html")) {
          console.error("[API Model] Google Drive final response is still HTML (possibly access denied or quota exceeded).");
          return new NextResponse("Google Drive final download response was HTML, indicating download failed (possibly access denied, quota exceeded, or recaptcha required).", { status: 500 });
        }
      } else {
        console.warn("[API Model] Google Drive returned HTML warning page but confirmation token could not be parsed.");
        return new NextResponse("Google Drive virus warning page received but bypass token not found in page.", { status: 500 });
      }
    }

    if (!response.body) {
      console.error("[API Model] Google Drive returned response without a body stream.");
      return new NextResponse("Google Drive returned empty response body", { status: 500 });
    }

    // Step 3: Stream the model binary back to the client with appropriate headers
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
    console.error("[API Model] Exception occurred while fetching model from Google Drive:", error);
    return new NextResponse(`Error fetching model: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}


