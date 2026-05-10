import type { APIRoute } from "astro";
import { getSupabase } from "~/lib/supabase";

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

  const supabase = getSupabase(ctx);
  const { data, error } = await supabase
    .from("action_log")
    .insert({
      user_id: ctx.locals.user.id,
      action_type: payload.action_type,
      issue_slug: payload.issue_slug ?? null,
      representative_name: payload.representative_name ?? null,
      representative_office: payload.representative_office ?? null,
      topic: payload.topic ?? null,
      notes: payload.notes ?? null,
      generated_letter_id: payload.generated_letter_id ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[me/actions] insert failed", error);
    return json({ error: "insert_failed" }, 500);
  }

  return json({ action: data }, 201);
};

export const GET: APIRoute = async (ctx) => {
  if (!ctx.locals.user) return json({ error: "not_authenticated" }, 401);

  const supabase = getSupabase(ctx);
  const { data, error } = await supabase
    .from("action_log")
    .select("*")
    .eq("user_id", ctx.locals.user.id)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) return json({ error: "query_failed" }, 500);
  return json({ actions: data ?? [] }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
