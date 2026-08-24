-- AlterTable: add slug column (nullable first)
ALTER TABLE "OrganizerProfile" ADD COLUMN "slug" TEXT;

-- Generate slugs for existing organizers
UPDATE "OrganizerProfile"
SET slug = lower(regexp_replace(
  "firstName" || '-' || "lastName" || '-' || substr(id, 1, 8),
  '[^a-zA-Z0-9-]', '-', 'g'
));

-- Add unique constraint
ALTER TABLE "OrganizerProfile" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "OrganizerProfile_slug_key" ON "OrganizerProfile"("slug");
