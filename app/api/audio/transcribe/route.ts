import { POST as handlerPOST } from "@/app/backend/api/audio/transcribe/handler";

export const runtime = "edge";

export async function POST(req: Request) {
  return handlerPOST(req);
}
