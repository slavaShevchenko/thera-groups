-- Group: minimum participants, duration in hours, certificate flag and program text.
-- All four are optional (nullable, no default) so existing rows stay valid.

ALTER TABLE "Group" ADD COLUMN "minParticipants" INTEGER;
ALTER TABLE "Group" ADD COLUMN "durationHours" INTEGER;
ALTER TABLE "Group" ADD COLUMN "certificateIssued" BOOLEAN;
ALTER TABLE "Group" ADD COLUMN "program" TEXT;

-- Same shape as the existing Group_capacity_check
ALTER TABLE "Group" ADD CONSTRAINT "Group_minParticipants_check" CHECK ("minParticipants" IS NULL OR "minParticipants" > 0);
ALTER TABLE "Group" ADD CONSTRAINT "Group_durationHours_check" CHECK ("durationHours" IS NULL OR "durationHours" > 0);
