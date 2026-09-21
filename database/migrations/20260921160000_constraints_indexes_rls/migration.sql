-- ==========================================
-- 1. Nullability backfill for String[] columns
-- ==========================================

UPDATE "OrganizerProfile" SET "specializations" = '{}' WHERE "specializations" IS NULL;
UPDATE "OrganizerProfile" SET "languages" = '{}' WHERE "languages" IS NULL;
UPDATE "OrganizerProfile" SET "workFormats" = '{}' WHERE "workFormats" IS NULL;
UPDATE "ApplicationQuestion" SET "options" = '{}' WHERE "options" IS NULL;

ALTER TABLE "OrganizerProfile" ALTER COLUMN "specializations" SET NOT NULL;
ALTER TABLE "OrganizerProfile" ALTER COLUMN "specializations" SET DEFAULT '{}';
ALTER TABLE "OrganizerProfile" ALTER COLUMN "languages" SET NOT NULL;
ALTER TABLE "OrganizerProfile" ALTER COLUMN "languages" SET DEFAULT '{}';
ALTER TABLE "OrganizerProfile" ALTER COLUMN "workFormats" SET NOT NULL;
ALTER TABLE "OrganizerProfile" ALTER COLUMN "workFormats" SET DEFAULT '{}';
ALTER TABLE "ApplicationQuestion" ALTER COLUMN "options" SET NOT NULL;
ALTER TABLE "ApplicationQuestion" ALTER COLUMN "options" SET DEFAULT '{}';

-- ==========================================
-- 2. CHECK constraints
-- ==========================================

ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "Group" ADD CONSTRAINT "Group_price_check" CHECK ("priceAmount" IS NULL OR "priceAmount" >= 0);
ALTER TABLE "Group" ADD CONSTRAINT "Group_dates_check" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "Group" ADD CONSTRAINT "Group_capacity_check" CHECK (capacity IS NULL OR capacity > 0);
ALTER TABLE "User" ADD CONSTRAINT "User_locale_check" CHECK ("preferredLocale" IN ('ua', 'en'));

-- ==========================================
-- 3. Unique indexes (deduplicate first)
-- ==========================================

-- Application: keep earliest application per (groupId, email), remove duplicates
DELETE FROM "Application"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "groupId", email ORDER BY "createdAt" ASC) AS rn
    FROM "Application"
  ) sub
  WHERE rn > 1
);

CREATE UNIQUE INDEX "Application_groupId_email_key" ON "Application"("groupId", "email");

-- Review: keep earliest review per (userId, groupId), remove duplicates
DELETE FROM "Review"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId", "groupId" ORDER BY "createdAt" ASC) AS rn
    FROM "Review"
  ) sub
  WHERE rn > 1
);

CREATE UNIQUE INDEX "Review_userId_groupId_key" ON "Review"("userId", "groupId");

-- ==========================================
-- 4. Add sort indexes
-- ==========================================

CREATE INDEX "Group_startsAt_idx" ON "Group"("startsAt");
CREATE INDEX "Group_createdAt_idx" ON "Group"("createdAt");
CREATE INDEX "OrganizerProfile_verificationStatus_idx" ON "OrganizerProfile"("verificationStatus");
CREATE INDEX "User_role_idx" ON "User"("role");

-- ==========================================
-- 5. Remove redundant prefix indexes
-- ==========================================

-- Group: [status] is prefix of [status, type]
DROP INDEX IF EXISTS "Group_status_idx";

-- GroupCoOrganizer: [groupId] is prefix of unique [groupId, userId]
DROP INDEX IF EXISTS "GroupCoOrganizer_groupId_idx";

-- ApplicationAnswer: [applicationId] is prefix of unique [applicationId, questionId]
DROP INDEX IF EXISTS "ApplicationAnswer_applicationId_idx";

-- Notification: [userId] is prefix of [userId, readAt]
DROP INDEX IF EXISTS "Notification_userId_idx";

-- Favorite: [userId] is prefix of composite PK [userId, groupId]
DROP INDEX IF EXISTS "Favorite_userId_idx";

-- ==========================================
-- 6. RLS on tables missed by original DO-loop
-- ==========================================

ALTER TABLE "GroupCoOrganizer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 7. Enum: add APPLICATION_WITHDRAWN
-- ==========================================

ALTER TYPE "NotificationType" ADD VALUE 'APPLICATION_WITHDRAWN';
