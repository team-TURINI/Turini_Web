import "server-only";

import { CONVERSATIONS_LIMIT } from "../coach-utils";
import { ensureSchema, getSql } from "./db";

/**
 * AI 코치 대화 저장소 (docs/ERD.md 2절 turini_conversations · turini_messages).
 * 모든 쿼리에 user_id 조건을 붙여 다른 사용자의 대화는 읽거나 고칠 수 없게 한다.
 */

export type ConversationRow = {
  id: string;
  title: string;
  state: Record<string, unknown> | null;
  message_count: number;
};

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export async function listConversations(userId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, title, message_count, updated_at
    FROM turini_conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${CONVERSATIONS_LIMIT}
  `;
  return rows.map((row) => ({
    conversationId: String(row.id),
    title: String(row.title),
    updatedAt: isoString(row.updated_at),
    messageCount: Number(row.message_count),
  }));
}

export async function getConversation(userId: string, conversationId: string): Promise<ConversationRow | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, title, state, message_count
    FROM turini_conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    state: row.state && typeof row.state === "object" ? row.state as Record<string, unknown> : null,
    message_count: Number(row.message_count),
  };
}

/** 최근 것부터 limit 개를 가져와 오래된 순으로 돌려준다. 대화가 없거나 남의 것이면 null. */
export async function listMessages(userId: string, conversationId: string, limit: number, beforeSeq: number | null) {
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) return null;
  const sql = getSql();
  const rows = beforeSeq === null
    ? await sql`
        SELECT seq, role, content, meta, created_at
        FROM turini_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY seq DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT seq, role, content, meta, created_at
        FROM turini_messages
        WHERE conversation_id = ${conversationId} AND seq < ${beforeSeq}
        ORDER BY seq DESC
        LIMIT ${limit}
      `;
  return rows.reverse().map((row) => {
    const meta = row.meta && typeof row.meta === "object" ? row.meta as Record<string, unknown> : null;
    return {
      seq: Number(row.seq),
      role: row.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(row.content),
      createdAt: isoString(row.created_at),
      ...(row.role === "assistant" && typeof meta?.status === "string" ? { status: meta.status } : {}),
    };
  });
}

export type SaveTurnInput = {
  userId: string;
  conversationId: string;
  /** 새 대화면 제목을, 이어가는 대화면 null 을 준다 */
  newTitle: string | null;
  /** RAG 를 부르기 전에 읽은 message_count */
  previousCount: number;
  question: string;
  answer: string;
  meta: Record<string, unknown>;
  state: Record<string, unknown> | null;
};

/**
 * 질문 하나의 결과(메시지 2줄 + 문맥)를 한 트랜잭션으로 저장한다.
 * 같은 대화에 다른 질문이 먼저 저장됐으면 (conversation_id, seq) 기본키가 겹쳐 전체가 취소되고 "conflict" 를 돌려준다.
 */
export async function saveTurn(input: SaveTurnInput): Promise<"saved" | "conflict"> {
  await ensureSchema();
  const sql = getSql();
  const userSeq = input.previousCount + 1;
  const assistantSeq = input.previousCount + 2;
  const stateJson = input.state ? JSON.stringify(input.state) : null;
  const metaJson = JSON.stringify(input.meta);
  try {
    await sql.transaction([
      input.newTitle !== null
        ? sql`
            INSERT INTO turini_conversations (id, user_id, title, state, message_count)
            VALUES (${input.conversationId}, ${input.userId}, ${input.newTitle}, ${stateJson}::jsonb, ${assistantSeq})
          `
        : sql`
            UPDATE turini_conversations
            SET state = ${stateJson}::jsonb, message_count = ${assistantSeq}, updated_at = NOW()
            WHERE id = ${input.conversationId} AND user_id = ${input.userId}
          `,
      sql`
        INSERT INTO turini_messages (conversation_id, seq, role, content)
        VALUES (${input.conversationId}, ${userSeq}, 'user', ${input.question})
      `,
      sql`
        INSERT INTO turini_messages (conversation_id, seq, role, content, meta)
        VALUES (${input.conversationId}, ${assistantSeq}, 'assistant', ${input.answer}, ${metaJson}::jsonb)
      `,
    ]);
    return "saved";
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    // 23505 순번 중복(동시 질문) · 23503 대화가 그 사이에 삭제됨
    if (code === "23505" || code === "23503") return "conflict";
    throw error;
  }
}

export async function renameConversation(userId: string, conversationId: string, title: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE turini_conversations SET title = ${title}
    WHERE id = ${conversationId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteConversation(userId: string, conversationId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM turini_conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}
