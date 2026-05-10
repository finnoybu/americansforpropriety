import type { APIRoute } from "astro";
import { eq, desc } from "drizzle-orm";
import { getDb } from "~/db";
import { actionLog } from "~/db/schema";

export const prerender = false;

const ACTION_TYPES = new Set([
  "sent_letter",
  "made_call",
  "submitted_testimony",
  "attended_event",
  "signed_petition",
  "other",
]);

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.user) return json({ error: "not_authenticated" }, 401);

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!payload?.action_type || !ACTION_TYPES.has(payload.action_type)) {
    return json({ error: "invalid_action_type" }, 400);
  }

  const db = getDb(ctx);
  try {
    const [row] = await db
      .insert(actionLog)
      .values({
        userId: ctx.locals.user.id,
        actionType: payload.action_type,
        issueSlug: payload.issue_slug ?? null,
        representativeName: payload.representative_name ?? null,
        representativeOffice: payload.representative_office ?? null,
        topic: payload.topic ?? null,
        notes: payload.notes ?? null,
        generatedLetterId: payload.generated_letter_id ?? null,
      })
      .returning();
    return json({ action: row }, 201);
  } catch (err) {
    console.error("[me/actions] insert failed", err);
    return json({ error: "insert_failed" }, 500);
  }
};

export const GET: APIRoute = async (ctx) => {
  if (!ctx.locals.user) return json({ error: "not_authenticated" }, 401);

  try {
    const db = getDb(ctx);
    const rows = await db
      .select()
      .from(actionLog)
      .where(eq(actionLog.userId, ctx.locals.user.id))
      .orderBy(desc(actionLog.occurredAt))
      .limit(50);
    return json({ actions: rows }, 200);
  } catch (err) {
    console.error("[me/actions] query failed", err);
    return json({ error: "query_failed" }, 500);
  }
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
