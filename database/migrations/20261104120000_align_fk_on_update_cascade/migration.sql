-- Put the two foreign keys that lost their ON UPDATE action back in line with the other 16.
--
-- 20260921120000_gdpr_ondelete_cascade recreated "Group_organizerId_fkey" and
-- "Report_reporterId_fkey" to change what happens on delete, and wrote them without the
-- ON UPDATE CASCADE clause every other constraint in this schema carries. PostgreSQL's
-- default filled in NO ACTION, so the two have silently disagreed with schema.prisma ever
-- since.
--
-- Nothing can observe the difference: both reference a cuid primary key
-- ("OrganizerProfile".id, "User".id) that no code path rewrites, and Prisma has no update
-- that would move a row's id. The reason to fix it anyway is the drift itself. This project
-- writes migrations by hand and never runs `prisma migrate dev`, so `prisma migrate diff
-- --from-config-datasource --to-schema database/schema.prisma` is the only check that can
-- tell us the database still matches the model — a check that always prints something is a
-- check nobody reads, and the tempting way to silence it (`prisma db push`, or
-- `migrate dev` on a database it wants to reset) is the destructive one.
--
-- Aligning the database to the schema rather than the reverse: CASCADE is the convention,
-- and the two outliers are the accident.
--
-- Recreating a foreign key takes an ACCESS EXCLUSIVE lock and the ADD re-validates every
-- referencing row, so this is not free on a busy table. "Group" holds 4 rows and "Report" is
-- empty, and Prisma runs the file in one transaction, so no write can land between the DROP
-- and the ADD.

ALTER TABLE "Group" DROP CONSTRAINT "Group_organizerId_fkey";

ALTER TABLE "Group" ADD CONSTRAINT "Group_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";

ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
