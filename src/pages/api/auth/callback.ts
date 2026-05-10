import type { APIRoute } from "astro";
import { getSupabase } from "~/lib/supabase";

export const prerender = false;

// Magic-link callback. Supabase redirects here after the user clicks the link.
// We exchange the code for a session, set cookies, and redirect to /member.
export const GET: APIRoute = async (ctx) => {
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/member";

  if (!code) {
    return ctx.redirect("/signin?error=missing_code");
  }

  const supabase = getSupabase(ctx);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback]", error);
    return ctx.redirect(`/signin?error=${encodeURIComponent(error.message)}`);
  }

  return ctx.redirect(next);
};
