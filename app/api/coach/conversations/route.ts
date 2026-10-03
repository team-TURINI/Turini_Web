import { getCurrentUser } from "@/app/server/auth";
import { listConversations } from "@/app/server/coach-store";
import { databaseErrorResponse } from "@/app/server/db";

export const runtime = "nodejs";

/** 내 대화 목록 (최근 순). RAG 서버를 거치지 않는다. docs/API_SPEC.md 3-3절 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    return Response.json({ conversations: await listConversations(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
