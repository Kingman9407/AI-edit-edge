import crypto from "crypto";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export const runtime = "nodejs";

const getCloudinaryConfig = (): CloudinaryConfig | null => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
};

const normalizeName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "video";

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

export async function POST(req: Request) {
  const config = getCloudinaryConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "Cloudinary signing is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      },
      { status: 500 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const filename =
    typeof body?.filename === "string" && body.filename
      ? body.filename
      : "video";
  const baseName = normalizeName(filename);
  const publicId = `ai-editor/${baseName}-${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createSignature(
    {
      public_id: publicId,
      timestamp,
    },
    config.apiSecret
  );

  return Response.json({
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    publicId,
  });
}
