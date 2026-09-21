-- Drop foreign key constraint on Group.organizerId
ALTER TABLE "Group" DROP CONSTRAINT "Group_organizerId_fkey";

-- Make organizerId nullable
ALTER TABLE "Group" ALTER COLUMN "organizerId" DROP NOT NULL;

-- Add foreign key with ON DELETE SET NULL
ALTER TABLE "Group" ADD CONSTRAINT "Group_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE SET NULL;

-- Drop foreign key constraint on Report.reporterId
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";

-- Add foreign key with ON DELETE CASCADE
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE;
