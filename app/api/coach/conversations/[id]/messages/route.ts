import { clampMessageLimit, isConversationId, parseBeforeSeq } from "@/app/coach-utils";
import { getCurrentUser } from "@/app/server/auth";
import { listMessages } from "@/app/server/coach-store";
import { databaseErrorResponse } from "@/app/server/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** 대화 내역 (오래된 순). beforeSeq 를 주면 그보다 앞선 메시지. docs/API_SPEC.md 3-3절 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    const { id } = await context.params;
    const query = new URL(request.url).searchParams;
    const messages = isConversationId(id)
      ? await listMessages(user.id, id, clampMessageLimit(query.get("limit")), parseBeforeSeq(query.get("beforeSeq")))
      : null;
    if (!messages) return Response.json({ error: "대화를 찾지 못했어요." }, { status: 404 });
    return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
