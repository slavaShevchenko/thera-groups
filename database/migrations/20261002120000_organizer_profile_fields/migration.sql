-- OrganizerProfile: education becomes a multi-value field, professional organization
-- fields are added, TikTok is dropped.

-- 1) education: TEXT -> TEXT[] (existing single value is preserved as the first element)
ALTER TABLE "OrganizerProfile" ALTER COLUMN "education" DROP DEFAULT;
ALTER TABLE "OrganizerProfile" ALTER COLUMN "education" TYPE TEXT[] USING CASE
  WHEN "education" IS NULL OR "education" = '' THEN '{}'
  ELSE ARRAY["education"]
END;
ALTER TABLE "OrganizerProfile" ALTER COLUMN "education" SET NOT NULL;
ALTER TABLE "OrganizerProfile" ALTER COLUMN "education" SET DEFAULT '{}';

-- 2) professional organization (required at the application layer;
--    DEFAULT '' keeps existing rows valid)
ALTER TABLE "OrganizerProfile" ADD COLUMN "professionalOrganization" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrganizerProfile" ADD COLUMN "professionalOrganizationStatus" TEXT NOT NULL DEFAULT '';

-- 3) TikTok is no longer supported
ALTER TABLE "OrganizerProfile" DROP COLUMN IF EXISTS "tiktokUrl";
