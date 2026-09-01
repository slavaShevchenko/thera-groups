-- Drop the relation table first
DROP TABLE IF EXISTS "_OrganizerProfileToSpecialization" CASCADE;

-- Drop the Specialization table
DROP TABLE IF EXISTS "Specialization" CASCADE;

-- Drop the old single specialization column
ALTER TABLE "OrganizerProfile" DROP COLUMN IF EXISTS "specialization";

-- Rename customSpecializations to specializations
ALTER TABLE "OrganizerProfile" RENAME COLUMN "customSpecializations" TO "specializations";
