import type { APIRoute } from "astro";
import { getSupabase } from "~/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const supabase = getSupabase(ctx);
  await supabase.auth.signOut();
  return ctx.redirect("/");
};

export const GET = POST;
