import crypto from "crypto";

type Segment = {
  start: number;
  end: number;
};

type ExportMode = "sequential" | "ai";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret?: string;
  uploadPreset?: string;
};

type UploadResult = {
  public_id: string;
  secure_url?: string;
  url?: string;
};

export const runtime = "nodejs";

const MAX_PARALLEL_CLIPS = 4;

const getCloudinaryConfig = (): CloudinaryConfig | null => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !apiKey) return null;
  return { cloudName, apiKey, apiSecret, uploadPreset };
};

const normalizeName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "video";

const normalizeSegments = (raw: Segment[]): Segment[] =>
  raw
    .map((segment) => ({
      start: Math.max(0, Number(segment.start)),
      end: Math.max(0, Number(segment.end)),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start
    );

const toTimeString = (value: number) =>
  Number(value.toFixed(3)).toString();

const toLayerId = (publicId: string) => publicId.replace(/\//g, ":");

const buildConcatUrls = (
  cloudName: string,
  clipPublicIds: string[]
): { previewUrl: string; downloadUrl: string } => {
  if (!clipPublicIds.length) {
    throw new Error("No clips available to merge.");
  }
  const baseId = clipPublicIds[0];
  const overlays = clipPublicIds
    .slice(1)
    .map((clipId) => `l_video:${toLayerId(clipId)},fl_splice`);
  const chain = overlays.length ? `${overlays.join("/")}/` : "";
  const base = encodeURIComponent(baseId).replace(/%2F/g, "/");
  const prefix = `https://res.cloudinary.com/${cloudName}/video/upload/`;
  return {
    previewUrl: `${prefix}${chain}${base}.mp4`,
    downloadUrl: `${prefix}${chain}fl_attachment/${base}.mp4`,
  };
};

const createSignature = (
  params: Record<string, string | number | undefined>,
  apiSecret: string
) => {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  const payload = pairs.join("&");
  return crypto.createHash("sha1").update(payload + apiSecret).digest("hex");
};

const cloudinaryRequest = async (
  cloudName: string,
  body: FormData
): Promise<UploadResult> => {
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    { method: "POST", body }
  );
  const raw = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      data?.error?.message || raw?.slice(0, 200) || "Cloudinary request failed";
    throw new Error(message);
  }
  return data as UploadResult;
};

const uploadBaseVideo = async (
  file: File,
  publicId: string,
  config: CloudinaryConfig
) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append("file", file);
  form.append("public_id", publicId);
  form.append("timestamp", timestamp.toString());

  if (config.uploadPreset) {
    form.append("upload_preset", config.uploadPreset);
    form.append("api_key", config.apiKey);
  } else if (config.apiSecret) {
    const signature = createSignature(
      {
        public_id: publicId,
        timestamp,
      },
      config.apiSecret
    );
    form.append("api_key", config.apiKey);
    form.append("signature", signature);
  } else {
    throw new Error(
      "Cloudinary API secret or upload preset is required for uploads."
    );
  }

  return cloudinaryRequest(config.cloudName, form);
};

const createClip = async (
  baseUrl: string,
  clipPublicId: string,
  segment: Segment,
  config: CloudinaryConfig
) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const safeStart = Math.max(0, segment.start);
  const safeEnd = Math.max(safeStart, segment.end);
  const duration = Math.max(0, safeEnd - safeStart);
  const transformation = `so_${toTimeString(safeStart)},du_${toTimeString(
    duration
  )}`;
  const form = new FormData();
  form.append("file", baseUrl);
  form.append("public_id", clipPublicId);
  form.append("timestamp", timestamp.toString());
  form.append("transformation", transformation);
  form.append("overwrite", "true");

  if (config.uploadPreset) {
    form.append("upload_preset", config.uploadPreset);
    form.append("api_key", config.apiKey);
  } else if (config.apiSecret) {
    const signature = createSignature(
      {
        public_id: clipPublicId,
        timestamp,
        transformation,
        overwrite: "true",
      },
      config.apiSecret
    );
    form.append("api_key", config.apiKey);
    form.append("signature", signature);
  } else {
    throw new Error(
      "Cloudinary API secret or upload preset is required for uploads."
    );
  }

  await cloudinaryRequest(config.cloudName, form);
  return clipPublicId;
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) => {
  const results: R[] = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }).map(
    async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }
  );
  await Promise.all(runners);
  return results;
};

export async function POST(req: Request) {
  const config = getCloudinaryConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_UPLOAD_PRESET).",
      },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const segmentsRaw = formData.get("segments");
  const modeRaw = formData.get("mode");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing video file." }, { status: 400 });
  }

  if (typeof segmentsRaw !== "string") {
    return Response.json({ error: "Missing segments." }, { status: 400 });
  }

  let segments: Segment[] = [];
  try {
    segments = normalizeSegments(JSON.parse(segmentsRaw) as Segment[]);
  } catch {
    segments = [];
  }

  if (!segments.length) {
    return Response.json(
      { error: "No valid trim segments found." },
      { status: 400 }
    );
  }

  const mode: ExportMode = modeRaw === "ai" ? "ai" : "sequential";
  const baseName = normalizeName(file.name || "video");
  const basePublicId = `ai-editor/${baseName}-${Date.now()}`;

  let baseResult: UploadResult;
  try {
    baseResult = await uploadBaseVideo(file, basePublicId, config);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Cloudinary upload failed.",
      },
      { status: 500 }
    );
  }

  const baseUrl = baseResult.secure_url || baseResult.url;
  if (!baseUrl) {
    return Response.json(
      { error: "Cloudinary upload returned no URL." },
      { status: 500 }
    );
  }

  const clipIds = segments.map(
    (_, index) => `${basePublicId}_clip_${index + 1}`
  );

  try {
    if (mode === "ai") {
      await runWithConcurrency(
        segments,
        MAX_PARALLEL_CLIPS,
        async (segment, index) =>
          createClip(baseUrl, clipIds[index], segment, config)
      );
    } else {
      for (let i = 0; i < segments.length; i += 1) {
        await createClip(baseUrl, clipIds[i], segments[i], config);
      }
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Clip processing failed.",
      },
      { status: 500 }
    );
  }

  let urls: { previewUrl: string; downloadUrl: string };
  try {
    urls = buildConcatUrls(config.cloudName, clipIds);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to build export URL.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    previewUrl: urls.previewUrl,
    downloadUrl: urls.downloadUrl,
    name: `${baseName}_final.mp4`,
    clipCount: clipIds.length,
    mode,
  });
}
