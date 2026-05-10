// Drizzle schema for SQLite / Cloudflare D1.
//
// Layout:
//   - Better Auth managed tables (user, session, account, verification) — names
//     and column shapes match Better Auth's expected adapter contract.
//   - App tables: profile, actionLog, generatedLetter, aiBrief.
//
// Conventions:
//   - Primary keys are text UUIDs generated in app code (crypto.randomUUID()).
//   - Timestamps stored as INTEGER (epoch ms) via Drizzle's `mode: "timestamp"`.
//   - JSON columns stored as TEXT with `mode: "json"`.
//   - Row-level ownership is enforced in app code rather than DB-side RLS
//     (SQLite doesn't have RLS the way Postgres does).

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Representative } from "~/lib/geocodio";

export type { Representative };

// =============================================================================
// Better Auth tables
// =============================================================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  name: text("name"),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// =============================================================================
// App tables
// =============================================================================

export const profile = sqliteTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  zip: text("zip"),
  state: text("state"),
  city: text("city"),
  congressionalDistrict: text("congressional_district"),
  stateLegislativeLowerDistrict: text("state_legislative_lower_district"),
  stateLegislativeUpperDistrict: text("state_legislative_upper_district"),
  representativesCache: text("representatives_cache", { mode: "json" })
    .$type<Representative[]>(),
  representativesCachedAt: integer("representatives_cached_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const actionLog = sqliteTable("action_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  issueSlug: text("issue_slug"),
  representativeName: text("representative_name"),
  representativeOffice: text("representative_office"),
  topic: text("topic"),
  notes: text("notes"),
  // Slug of the letter template the member used (when actionType = "sent_letter").
  // Replaces the previous generated_letter_id FK now that we no longer store
  // AI-drafted letter bodies.
  letterTemplateSlug: text("letter_template_slug"),
  occurredAt: integer("occurred_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aiBrief = sqliteTable("ai_brief", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  issue: text("issue").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  usedWebSearch: integer("used_web_search", { mode: "boolean" }).default(true),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  readingMinutes: integer("reading_minutes").default(6),
  authors: text("authors", { mode: "json" })
    .$type<string[]>()
    .default([]),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  publishedBy: text("published_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// Re-exported types for use across the app
export type User = typeof user.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type ActionLog = typeof actionLog.$inferSelect;
export type AiBrief = typeof aiBrief.$inferSelect;
