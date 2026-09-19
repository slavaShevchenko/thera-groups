-- AlterEnum
ALTER TYPE "GroupStatus" ADD VALUE 'REJECTED';

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_organizerId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "priceAmount" SET DATA TYPE DECIMAL(65,30);

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
