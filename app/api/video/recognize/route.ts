import { POST as handlerPOST } from "@/app/backend/api/video/recognize/handler";

export async function POST(req: Request) {
  return handlerPOST(req);
}
