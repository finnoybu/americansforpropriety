import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "~/db";
import { aiBrief } from "~/db/schema";
import { getEnv, isAdminEmail } from "~/lib/env";

export const prerender = false;

// PATCH: update fields (title, summary, body, slug, status, issue)
// DELETE: delete a brief
export const PATCH: APIRoute = async (ctx) => {
  const gate = await adminGate(ctx);
  if (gate) return gate;

  const id = ctx.params.id;
  if (!id) return json({ error: "missing_id" }, 400);

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const updates: Record<string, unknown> = {};
  for (const k of ["title", "summary", "body", "slug", "issue"] as const) {
    if (typeof payload?.[k] === "string") updates[k] = payload[k];
  }
  if (typeof payload?.reading_minutes === "number") {
    updates.readingMinutes = payload.reading_minutes;
  }

  if (typeof payload?.status === "string") {
    if (!["draft", "published", "archived"].includes(payload.status)) {
      return json({ error: "invalid_status" }, 400);
    }
    updates.status = payload.status;
    if (payload.status === "published") {
      updates.publishedAt = new Date();
      updates.publishedBy = ctx.locals.user!.id;
    }
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "no_updates" }, 400);
  }

  try {
    const db = getDb(ctx);
    const [row] = await db
      .update(aiBrief)
      .set(updates as any)
      .where(eq(aiBrief.id, id))
      .returning();
    if (!row) return json({ error: "not_found" }, 404);
    return json({ brief: row }, 200);
  } catch (err) {
    console.error("[admin/briefs/PATCH] failed", err);
    return json(
      {
        error: "update_failed",
        message: err instanceof Error ? err.message : "Update failed",
      },
      500,
    );
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const gate = await adminGate(ctx);
  if (gate) return gate;

  const id = ctx.params.id;
  if (!id) return json({ error: "missing_id" }, 400);

  try {
    const db = getDb(ctx);
    await db.delete(aiBrief).where(eq(aiBrief.id, id));
    return json({ ok: true }, 200);
  } catch (err) {
    console.error("[admin/briefs/DELETE] failed", err);
    return json(
      {
        error: "delete_failed",
        message: err instanceof Error ? err.message : "Delete failed",
      },
      500,
    );
  }
};

async function adminGate(ctx: Parameters<APIRoute>[0]): Promise<Response | null> {
  if (!ctx.locals.user) return json({ error: "not_authenticated" }, 401);
  const env = getEnv(ctx);
  if (!isAdminEmail(ctx.locals.user.email, env)) {
    return json({ error: "not_admin" }, 403);
  }
  return null;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
