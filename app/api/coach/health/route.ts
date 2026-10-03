import { getCurrentUser } from "@/app/server/auth";
import { databaseErrorResponse } from "@/app/server/db";
import { ragHealth } from "@/app/server/rag-client";

export const runtime = "nodejs";

/** AI 코치(RAG 서버) 기동 여부. 내려가 있던 서버를 미리 깨우는 용도로도 쓴다. docs/API_SPEC.md 3-6절 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    return Response.json({ state: await ragHealth() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
