-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN "city" TEXT;
ALTER TABLE "OrganizerProfile" ADD COLUMN "education" TEXT;
ALTER TABLE "OrganizerProfile" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "OrganizerProfile" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "OrganizerProfile" ADD COLUMN "telegramUrl" TEXT;
ALTER TABLE "OrganizerProfile" ADD COLUMN "workFormats" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OrganizerProfile" ALTER COLUMN "languages" SET DEFAULT ARRAY[]::TEXT[];
