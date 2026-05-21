import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "~/db";
import {
  user,
  session,
  account,
  verification,
  profile,
  actionLog,
  aiBrief,
} from "~/db/schema";

export const prerender = false;

// POST /api/me/delete — permanently and immediately deletes the signed-in
// member's account and everything tied to it. Self-serve and irreversible.
// The client clears the (now-dead) session cookie and redirects afterward.
export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const { id: userId, email } = ctx.locals.user;

  let db;
  try {
    db = getDb(ctx);
  } catch (err) {
    console.error("[me/delete] no D1 binding", err);
    return json({ error: "unavailable" }, 503);
  }

  try {
    // One atomic D1 batch. Child rows are deleted before the user row so this
    // holds whether or not D1 is enforcing the schema's ON DELETE rules.
    await db.batch([
      db.delete(actionLog).where(eq(actionLog.userId, userId)),
      db.delete(profile).where(eq(profile.userId, userId)),
      // An admin member may have authored AI briefs — keep the briefs, drop
      // the attribution (mirrors the schema's ON DELETE SET NULL).
      db.update(aiBrief).set({ createdBy: null }).where(eq(aiBrief.createdBy, userId)),
      db.update(aiBrief).set({ publishedBy: null }).where(eq(aiBrief.publishedBy, userId)),
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);
  } catch (err) {
    console.error("[me/delete] deletion failed", err);
    return json({ error: "deletion_failed" }, 500);
  }

  return json({ ok: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
