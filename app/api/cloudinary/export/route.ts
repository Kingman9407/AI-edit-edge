import { POST as handlerPOST } from "@/app/backend/api/cloudinary/export/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handlerPOST(req);
}
