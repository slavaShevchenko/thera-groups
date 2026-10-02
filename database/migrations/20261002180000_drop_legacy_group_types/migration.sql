-- Group type consolidation (2026-10): drop the retired enum values.
--
-- PostgreSQL has no ALTER TYPE ... DROP VALUE, so the enum is rebuilt:
-- rename the old type, create the final one in schema order, re-cast the column,
-- then drop the old type. Group.type is the only column of this type and carries no
-- default, no CHECK constraint and no dependent view or function, so the re-cast is
-- self-contained. Indexes Group_type_idx and Group_status_type_idx are rebuilt by
-- the ALTER COLUMN TYPE automatically.
--
-- The previous migration guarantees no row still holds a retired value; if one did,
-- the USING cast below fails and this migration rolls back without touching data.

ALTER TYPE "GroupType" RENAME TO "GroupType_legacy";

CREATE TYPE "GroupType" AS ENUM (
  'THERAPEUTIC',
  'WORKSHOP',
  'SEMINAR',
  'LECTURE',
  'LECTURE_COURSE',
  'INTENSIVE',
  'AUTHOR_PROGRAM',
  'SUPERVISION',
  'INTERVISION',
  'CONFERENCE',
  'SYMPOSIUM',
  'CERTIFICATION',
  'SPECIALIZATION',
  'EDUCATIONAL_PROGRAMS',
  'MODULAR',
  'PILOT',
  'OTHER'
);

ALTER TABLE "Group"
  ALTER COLUMN "type" TYPE "GroupType"
  USING "type"::text::"GroupType";

DROP TYPE "GroupType_legacy";
