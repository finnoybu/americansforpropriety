-- Drop the AI letter generator's storage and rewire action_log to track
-- which letter template a member used.
--
-- Apply with the D1 console at:
--   Cloudflare → Storage & Databases → D1 → americansforpropriety → Console

DROP TABLE IF EXISTS `generated_letter`;

ALTER TABLE `action_log` DROP COLUMN `generated_letter_id`;

ALTER TABLE `action_log` ADD COLUMN `letter_template_slug` TEXT;
