-- Add missing NotificationType enum values
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_PENDING_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'ORGANIZER_PENDING_REVIEW';
