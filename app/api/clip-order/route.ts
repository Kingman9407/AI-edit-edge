import { POST as handlerPOST } from "@/app/backend/api/clip-order/handler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handlerPOST(req);
}
