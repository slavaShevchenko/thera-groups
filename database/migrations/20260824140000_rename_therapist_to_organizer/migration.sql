-- Rename enum value
ALTER TYPE "Role" RENAME VALUE 'THERAPIST' TO 'ORGANIZER';

-- Rename table
ALTER TABLE "TherapistProfile" RENAME TO "OrganizerProfile";

-- Rename columns in Group
ALTER TABLE "Group" RENAME COLUMN "therapistId" TO "organizerId";

-- Rename columns in Review
ALTER TABLE "Review" RENAME COLUMN "therapistId" TO "organizerId";

-- Rename indexes on Group
ALTER INDEX "Group_therapistId_idx" RENAME TO "Group_organizerId_idx";

-- Rename indexes on Review
ALTER INDEX "Review_therapistId_idx" RENAME TO "Review_organizerId_idx";

-- Rename indexes on OrganizerProfile (formerly TherapistProfile)
ALTER INDEX "TherapistProfile_pkey" RENAME TO "OrganizerProfile_pkey";
ALTER INDEX "TherapistProfile_userId_key" RENAME TO "OrganizerProfile_userId_key";
ALTER INDEX "TherapistProfile_userId_idx" RENAME TO "OrganizerProfile_userId_idx";

-- Rename foreign key constraints on Group
ALTER TABLE "Group" RENAME CONSTRAINT "Group_therapistId_fkey" TO "Group_organizerId_fkey";

-- Rename foreign key constraints on Review
ALTER TABLE "Review" RENAME CONSTRAINT "Review_therapistId_fkey" TO "Review_organizerId_fkey";

-- Rename foreign key constraint on OrganizerProfile (user relation)
ALTER TABLE "OrganizerProfile" RENAME CONSTRAINT "TherapistProfile_userId_fkey" TO "OrganizerProfile_userId_fkey";
