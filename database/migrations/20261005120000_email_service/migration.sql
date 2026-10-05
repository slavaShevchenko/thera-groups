-- Unified email service (2026-10): delivery lifecycle states plus per-message context.
--
-- Enum values are added in their own statements because PostgreSQL rejects using a new
-- enum value inside the transaction that created it ("unsafe use of new value of enum
-- type"), the same split already used by 20261002160000_add_group_type_values.
--
-- PENDING stays as the "queued" state: rows are inserted before the first delivery
-- attempt, so the existing default keeps working for rows already in the table.
ALTER TYPE "EmailEventStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TYPE "EmailEventStatus" ADD VALUE IF NOT EXISTS 'DEV_PREVIEW';
ALTER TYPE "EmailEventStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "EmailEventStatus" ADD VALUE IF NOT EXISTS 'COMPLAINED';

-- `type` keeps the NotificationType the message belongs to; `template` names the email
-- template that rendered it, so delivery rows stay readable when several templates map
-- onto one notification type.
ALTER TABLE "EmailEvent" ADD COLUMN IF NOT EXISTS "template" TEXT;
ALTER TABLE "EmailEvent" ADD COLUMN IF NOT EXISTS "locale" TEXT;

-- Rendered HTML, stored for DEV_PREVIEW rows only: in dev there is no provider inbox to
-- inspect, so the preview has to live here. Production rows leave it NULL.
ALTER TABLE "EmailEvent" ADD COLUMN IF NOT EXISTS "html" TEXT;

ALTER TABLE "EmailEvent" DROP CONSTRAINT IF EXISTS "EmailEvent_locale_check";
ALTER TABLE "EmailEvent"
  ADD CONSTRAINT "EmailEvent_locale_check"
  CHECK ("locale" IS NULL OR "locale" IN ('ua', 'en'));

-- The Resend delivery webhook locates the row by providerId, not by id.
CREATE INDEX IF NOT EXISTS "EmailEvent_providerId_idx" ON "EmailEvent"("providerId");
