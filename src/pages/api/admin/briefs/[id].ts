import type { APIRoute } from "astro";
import { getSupabaseService } from "~/lib/supabase";
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
    updates.reading_minutes = payload.reading_minutes;
  }

  if (typeof payload?.status === "string") {
    if (!["draft", "published", "archived"].includes(payload.status)) {
      return json({ error: "invalid_status" }, 400);
    }
    updates.status = payload.status;
    if (payload.status === "published") {
      updates.published_at = new Date().toISOString();
      updates.published_by = ctx.locals.user!.id;
    }
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "no_updates" }, 400);
  }

  const supabase = getSupabaseService(ctx);
  const { data, error } = await supabase
    .from("ai_briefs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/briefs/PATCH] failed", error);
    return json({ error: "update_failed", message: error.message }, 500);
  }
  return json({ brief: data }, 200);
};

export const DELETE: APIRoute = async (ctx) => {
  const gate = await adminGate(ctx);
  if (gate) return gate;

  const id = ctx.params.id;
  if (!id) return json({ error: "missing_id" }, 400);

  const supabase = getSupabaseService(ctx);
  const { error } = await supabase.from("ai_briefs").delete().eq("id", id);
  if (error) return json({ error: "delete_failed", message: error.message }, 500);
  return json({ ok: true }, 200);
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
