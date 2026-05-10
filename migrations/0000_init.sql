-- Initial schema for Americans for Propriety on Cloudflare D1 (SQLite).
--
-- Tables:
--   - Better Auth: user, session, account, verification
--   - App: profile, action_log, generated_letter, ai_brief
--
-- Apply with:
--   npm run db:migrate:local   (local D1 via wrangler)
--   npm run db:migrate:prod    (production D1)

-- =============================================================================
-- Better Auth tables
-- =============================================================================

CREATE TABLE `user` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `email` TEXT NOT NULL UNIQUE,
  `email_verified` INTEGER NOT NULL DEFAULT 0,
  `name` TEXT,
  `image` TEXT,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE TABLE `session` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `expires_at` INTEGER NOT NULL,
  `token` TEXT NOT NULL UNIQUE,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  `ip_address` TEXT,
  `user_agent` TEXT,
  `user_id` TEXT NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE
);

CREATE INDEX `session_user_id_idx` ON `session`(`user_id`);

CREATE TABLE `account` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `account_id` TEXT NOT NULL,
  `provider_id` TEXT NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `access_token` TEXT,
  `refresh_token` TEXT,
  `id_token` TEXT,
  `access_token_expires_at` INTEGER,
  `refresh_token_expires_at` INTEGER,
  `scope` TEXT,
  `password` TEXT,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE INDEX `account_user_id_idx` ON `account`(`user_id`);

CREATE TABLE `verification` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `identifier` TEXT NOT NULL,
  `value` TEXT NOT NULL,
  `expires_at` INTEGER NOT NULL,
  `created_at` INTEGER,
  `updated_at` INTEGER
);

CREATE INDEX `verification_identifier_idx` ON `verification`(`identifier`);

-- =============================================================================
-- App tables
-- =============================================================================

CREATE TABLE `profile` (
  `user_id` TEXT PRIMARY KEY NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `display_name` TEXT,
  `zip` TEXT,
  `state` TEXT,
  `city` TEXT,
  `congressional_district` TEXT,
  `state_legislative_lower_district` TEXT,
  `state_legislative_upper_district` TEXT,
  `representatives_cache` TEXT,        -- JSON-encoded Representative[]
  `representatives_cached_at` INTEGER,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE INDEX `profile_state_idx` ON `profile`(`state`);

CREATE TABLE `action_log` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `action_type` TEXT NOT NULL,
  `issue_slug` TEXT,
  `representative_name` TEXT,
  `representative_office` TEXT,
  `topic` TEXT,
  `notes` TEXT,
  `generated_letter_id` TEXT,
  `occurred_at` INTEGER NOT NULL,
  `created_at` INTEGER NOT NULL
);

CREATE INDEX `action_log_user_occurred_idx`
  ON `action_log`(`user_id`, `occurred_at` DESC);

CREATE TABLE `generated_letter` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `representative_name` TEXT,
  `representative_office` TEXT,
  `topic` TEXT,
  `stance` TEXT,
  `body` TEXT NOT NULL,
  `issue_slug` TEXT,
  `used_web_search` INTEGER DEFAULT 0,
  `model` TEXT,
  `input_tokens` INTEGER,
  `output_tokens` INTEGER,
  `created_at` INTEGER NOT NULL
);

CREATE INDEX `generated_letter_user_created_idx`
  ON `generated_letter`(`user_id`, `created_at` DESC);

CREATE TABLE `ai_brief` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `slug` TEXT NOT NULL UNIQUE,
  `title` TEXT NOT NULL,
  `summary` TEXT NOT NULL,
  `issue` TEXT NOT NULL,
  `body` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT 'draft',
  `used_web_search` INTEGER DEFAULT 1,
  `model` TEXT,
  `input_tokens` INTEGER,
  `output_tokens` INTEGER,
  `reading_minutes` INTEGER DEFAULT 6,
  `authors` TEXT DEFAULT '[]',
  `created_by` TEXT REFERENCES `user`(`id`) ON DELETE SET NULL,
  `published_at` INTEGER,
  `published_by` TEXT REFERENCES `user`(`id`) ON DELETE SET NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE INDEX `ai_brief_status_published_idx`
  ON `ai_brief`(`status`, `published_at` DESC);
CREATE INDEX `ai_brief_issue_status_idx`
  ON `ai_brief`(`issue`, `status`);
