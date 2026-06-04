import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const repoId = "Kingman9407/hornet";
  const url = `https://huggingface.co/${repoId}/resolve/main/${file}`;
  
  console.log(`\n[Local Tokenizer Proxy] 🔍 GET request for "${file}" -> Fetching from HF: ${url}`);

  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  const headers = new Headers();
  if (hfToken) {
    headers.set("Authorization", `Bearer ${hfToken.trim()}`);
    console.log("[Local Tokenizer Proxy] Auth token found and attached to HF request.");
  } else {
    console.warn("[Local Tokenizer Proxy] ⚠️ No HF_TOKEN or HUGGINGFACE_TOKEN found in environment.");
  }

  try {
    let response = await fetch(url, { headers });

    // Handle 302 Redirect manually for LFS files or CDN files if HF redirects
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
      const redirectUrl = response.headers.get("location");
      if (redirectUrl) {
        console.log(`[Local Tokenizer Proxy] 302 Redirect detected. Fetching CDN URL without Auth header: ${redirectUrl.slice(0, 100)}...`);
        response = await fetch(redirectUrl);
      }
    }

    if (response.status === 404) {
      console.error(`[Local Tokenizer Proxy] ❌ File not found on Hugging Face: "${file}"`);
      return new NextResponse(`File not found: ${file}`, { status: 404 });
    }

    if (!response.ok) {
      console.error(`[Local Tokenizer Proxy] ❌ Hugging Face request failed with status: ${response.status} ${response.statusText}`);
      return new NextResponse(`Hugging Face error: ${response.statusText}`, { status: response.status });
    }

    if (file === "tokenizer_config.json") {
      console.log("[Local Tokenizer Proxy] ⚙️  Reading and patching tokenizer_config.json for JS/transformers.js compatibility...");
      const config = await response.json();
      
      config.tokenizer_class = "PreTrainedTokenizerFast";
      
      const est = config.extra_special_tokens;
      if (est && typeof est === "object" && !Array.isArray(est)) {
        config.extra_special_tokens = Object.values(est);
      } else if (!est) {
        config.extra_special_tokens = ["<|im_start|>", "<|im_end|>"];
      }

      // Remove python specific fields
      delete config.is_local;
      delete config.local_files_only;
      delete config.backend;
      delete config.errors;

      console.log("[Local Tokenizer Proxy] ⚙️  Patched tokenizer_config.json successfully.");

      return new NextResponse(JSON.stringify(config, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Stream other files normally
    const contentType = response.headers.get("content-type") || (file.endsWith(".json") ? "application/json" : "application/octet-stream");
    const contentLen = response.headers.get("content-length");
    
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (contentLen) {
      responseHeaders["Content-Length"] = contentLen;
    }

    console.log(`[Local Tokenizer Proxy] 🚀 Streaming "${file}" from HF back to browser...`);
    return new NextResponse(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Local Tokenizer Proxy] ❌ Exception proxying tokenizer file "${file}":`, error);
    return new NextResponse(`Server error: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}
