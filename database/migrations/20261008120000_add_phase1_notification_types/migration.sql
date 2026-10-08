-- Notifications Phase 1 (2026-10): the four events that were silent before.
--
--   APPLICATION_SUBMITTED — acknowledgement to the applicant when an application lands
--   ORGANIZER_WELCOME     — welcome to a new organizer, telling them verification is pending
--   GROUP_SUBMITTED       — acknowledgement to the owner when a group goes to moderation
--   GROUP_AUTO_REVERT     — the owner is told why a PUBLISHED group fell back to moderation
--
-- Each value gets its own statement: PostgreSQL refuses to use a new enum value inside
-- the transaction that created it, the split already used by
-- 20261002160000_add_group_type_values and 20261005120000_email_service.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPLICATION_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORGANIZER_WELCOME';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_AUTO_REVERT';
