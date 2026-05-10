import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "~/config/site";
import { getSupabase } from "~/lib/supabase";
import { getEnv, isSupabaseConfigured } from "~/lib/env";
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext) {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  const briefs = await getCollection("briefs", ({ data }) => !data.draft);

  let aiRows: any[] | null = null;
  if (isSupabaseConfigured(getEnv(context))) {
    const supabase = getSupabase(context);
    const { data } = await supabase
      .from("ai_briefs")
      .select("slug, title, summary, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    aiRows = data;
  }

  const items = [
    ...posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.publishedAt,
      description: p.data.summary,
      link: `/news/${p.id}`,
    })),
    ...briefs.map((b) => ({
      title: `Brief: ${b.data.title}`,
      pubDate: b.data.publishedAt,
      description: b.data.summary,
      link: `/briefs/${b.id}`,
    })),
    ...((aiRows ?? []) as any[]).map((b) => ({
      title: `Weekly: ${b.title}`,
      pubDate: new Date(b.published_at),
      description: b.summary,
      link: `/briefs/${b.slug}`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: site.name,
    description: site.tagline,
    site: context.site ?? site.url,
    items,
  });
}
