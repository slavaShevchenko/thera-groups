-- Group lifecycle notifications (2026-10): the two transitions that were silent before.
--
--   GROUP_COMPLETED — the owner and every APPROVED applicant are told the group has ended
--   GROUP_CANCELLED — the same two audiences, plus the reason when one was recorded
--
-- Until now only the move into PENDING_REVIEW notified anyone, so an admin cancelling a
-- published group left its approved applicants believing they still had a seat.
--
-- Each value gets its own statement: PostgreSQL refuses to use a new enum value inside
-- the transaction that created it, the split already used by
-- 20261008120000_add_phase1_notification_types.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_CANCELLED';
