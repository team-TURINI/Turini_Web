import { isConversationId, normalizeTitle } from "@/app/coach-utils";
import { getCurrentUser } from "@/app/server/auth";
import { deleteConversation, renameConversation } from "@/app/server/coach-store";
import { databaseErrorResponse } from "@/app/server/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "대화를 찾지 못했어요." };

/** 제목 변경. docs/API_SPEC.md 3-3절 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    const { id } = await context.params;
    if (!isConversationId(id)) return Response.json(NOT_FOUND, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const title = normalizeTitle(body?.title);
    if (!title) return Response.json({ error: "제목은 1~80자로 입력해 주세요." }, { status: 400 });
    if (!(await renameConversation(user.id, id, title))) return Response.json(NOT_FOUND, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

/** 대화 삭제. 메시지는 외래키로 함께 지워진다. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    const { id } = await context.params;
    if (!isConversationId(id)) return Response.json(NOT_FOUND, { status: 404 });
    if (!(await deleteConversation(user.id, id))) return Response.json(NOT_FOUND, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
