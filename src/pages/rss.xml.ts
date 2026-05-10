import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { eq, desc } from "drizzle-orm";
import { site } from "~/config/site";
import { getDb, isDbConfigured } from "~/db";
import { aiBrief } from "~/db/schema";
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext) {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  const briefs = await getCollection("briefs", ({ data }) => !data.draft);

  let aiRows: { slug: string; title: string; summary: string; publishedAt: Date | null }[] = [];
  if (isDbConfigured(context)) {
    try {
      const db = getDb(context);
      aiRows = await db
        .select({
          slug: aiBrief.slug,
          title: aiBrief.title,
          summary: aiBrief.summary,
          publishedAt: aiBrief.publishedAt,
        })
        .from(aiBrief)
        .where(eq(aiBrief.status, "published"))
        .orderBy(desc(aiBrief.publishedAt));
    } catch (err) {
      console.error("[rss] ai_brief query failed", err);
    }
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
    ...aiRows
      .filter((b) => b.publishedAt !== null)
      .map((b) => ({
        title: `Weekly: ${b.title}`,
        pubDate: b.publishedAt as Date,
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
