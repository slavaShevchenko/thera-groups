-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ORGANIZER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'ORGANIZER_REJECTED';

-- CreateIndex
CREATE INDEX "Group_status_type_idx" ON "Group"("status", "type");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
