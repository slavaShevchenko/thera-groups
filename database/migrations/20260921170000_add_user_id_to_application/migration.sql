-- AlterTable
ALTER TABLE "Application" ADD COLUMN "userId" TEXT NULL;

-- Add index
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- Add foreign key constraint
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
