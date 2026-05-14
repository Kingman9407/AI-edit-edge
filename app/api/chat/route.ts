export const runtime = "edge";

import { POST as handlerPOST } from "@/app/backend/api/chat/handler";

export async function POST(req: Request) {
  return handlerPOST(req);
}
