import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const issues = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/issues" }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    eyebrow: z.string().default("Issue area"),
    summary: z.string(),
    accent: z.enum(["coral", "gold", "leaf", "ink"]).default("coral"),
    order: z.number().default(99),
    headline: z.string(),
    stance: z.string(),
    pillars: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
    facts: z.array(z.string()).default([]),
    subtopics: z
      .array(
        z.object({
          slug: z.string(),
          title: z.string(),
          summary: z.string(),
          body: z.string(),
        }),
      )
      .default([]),
    keyBills: z
      .array(
        z.object({
          name: z.string(),
          chamber: z.enum(["federal", "state"]).default("federal"),
          summary: z.string(),
          status: z.string(),
        }),
      )
      .default([]),
    glossary: z
      .array(z.object({ term: z.string(), definition: z.string() }))
      .default([]),
    whoAffected: z.string().optional(),
    timeline: z
      .array(z.object({ date: z.string(), event: z.string() }))
      .default([]),
    relatedBriefs: z.array(z.string()).default([]),
    relatedLetters: z.array(z.string()).default([]),
    relatedActions: z.array(z.string()).default([]),
  }),
});

const briefs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/briefs" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    issue: z.string(),
    publishedAt: z.coerce.date(),
    authors: z.array(z.string()).default([]),
    readingMinutes: z.number().default(6),
    draft: z.boolean().default(false),
  }),
});

const letters = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/letters" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    audience: z.string(),
    issue: z.string(),
    updatedAt: z.coerce.date(),
  }),
});

const actions = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/actions" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    issue: z.string(),
    cta: z.string(),
    href: z.string(),
    urgency: z.enum(["low", "medium", "high"]).default("medium"),
    expiresAt: z.coerce.date().optional(),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishedAt: z.coerce.date(),
    authors: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { issues, briefs, letters, actions, posts };
