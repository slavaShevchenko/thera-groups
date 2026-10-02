-- Group type consolidation (2026-10): add the three types introduced by the merge.
--
-- Kept separate from the data rewrite below because PostgreSQL rejects using an
-- enum value inside the same transaction that added it
-- ("unsafe use of new value of enum type").
ALTER TYPE "GroupType" ADD VALUE IF NOT EXISTS 'INTERVISION';
ALTER TYPE "GroupType" ADD VALUE IF NOT EXISTS 'SYMPOSIUM';
ALTER TYPE "GroupType" ADD VALUE IF NOT EXISTS 'EDUCATIONAL_PROGRAMS';
