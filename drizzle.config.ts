// Drizzle Kit config for generating SQLite migrations.
//
// Usage:
//   npm run db:generate       — generate a new migration from schema diff
//   npm run db:migrate:local  — apply migrations to local D1 (via wrangler)
//   npm run db:migrate:prod   — apply migrations to remote D1 (production)

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  // We don't connect drizzle-kit to D1 directly; wrangler applies the SQL files.
});
