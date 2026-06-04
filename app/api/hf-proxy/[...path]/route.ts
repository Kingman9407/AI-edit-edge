import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * This route acts as an authenticated proxy for HuggingFace tokenizer files.
 * It intercepts requests made by @huggingface/transformers when env.remoteHost
 * is set to point here.
 *
 * The library constructs URLs like:
 *   {remoteHost}{repoId}/resolve/{revision}/{file}
 * So this route catches:
 *   /api/hf-proxy/Kingman9407/hornet/resolve/main/tokenizer_config.json
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = path.join("/");
  const hfUrl = `https://huggingface.co/${filePath}`;

  console.log(`\n[HF Proxy] 🔍 GET /${filePath}`);
  console.log(`[HF Proxy] Proxying to: ${hfUrl}`);

  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  const fetchHeaders = new Headers();
  if (hfToken) {
    fetchHeaders.set("Authorization", `Bearer ${hfToken.trim()}`);
    console.log("[HF Proxy] Auth token attached.");
  } else {
    console.warn("[HF Proxy] ⚠️ No HF_TOKEN found — gated repo will fail.");
  }

  try {
    let response = await fetch(hfUrl, { headers: fetchHeaders, redirect: "manual" });

    // Handle 302 Redirect (LFS / CDN redirect) — strip auth header
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
      const redirectUrl = response.headers.get("location");
      if (redirectUrl) {
        console.log(`[HF Proxy] Redirect → ${redirectUrl.slice(0, 100)}...`);
        response = await fetch(redirectUrl);
      }
    }

    if (!response.ok) {
      console.error(`[HF Proxy] ❌ HF returned ${response.status} ${response.statusText}`);
      return new NextResponse(`HuggingFace error: ${response.statusText}`, { status: response.status });
    }

    const fileName = path[path.length - 1];

    // Patch tokenizer_config.json: change tokenizer_class to PreTrainedTokenizerFast
    if (fileName === "tokenizer_config.json") {
      console.log("[HF Proxy] ⚙️  Patching tokenizer_config.json for JS compatibility...");
      const config = await response.json();

      config.tokenizer_class = "PreTrainedTokenizerFast";

      // Convert extra_special_tokens dict → array (JS library needs array)
      const est = config.extra_special_tokens;
      if (est && typeof est === "object" && !Array.isArray(est)) {
        config.extra_special_tokens = Object.values(est);
      } else if (!est) {
        config.extra_special_tokens = ["<|im_start|>", "<|im_end|>"];
      }

      // Remove Python-only fields
      delete config.is_local;
      delete config.local_files_only;
      delete config.backend;
      delete config.errors;

      console.log("[HF Proxy] ✅ Patched tokenizer_config.json:", {
        tokenizer_class: config.tokenizer_class,
        eos_token: config.eos_token,
        extra_special_tokens: config.extra_special_tokens,
      });

      return new NextResponse(JSON.stringify(config, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // All other files: stream through as-is
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    };
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    console.log(`[HF Proxy] 🚀 Streaming "${fileName}" (${contentLength ? Math.round(Number(contentLength) / 1024) + " KB" : "unknown size"})`);
    return new NextResponse(response.body, { status: 200, headers: responseHeaders });

  } catch (error) {
    console.error(`[HF Proxy] ❌ Exception proxying "${filePath}":`, error);
    return new NextResponse(`Server error: ${error instanceof Error ? error.message : error}`, { status: 500 });
  }
}
