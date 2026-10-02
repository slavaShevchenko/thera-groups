-- Group type consolidation (2026-10): move rows off the retired enum values.
-- Must run before 20261002180000_drop_legacy_group_types, which rebuilds the enum
-- and would fail to cast any row still holding a retired value.

-- The three level-based program types collapse into a single educational bucket.
UPDATE "Group" SET "type" = 'EDUCATIONAL_PROGRAMS'
WHERE "type" IN ('FOUNDATION', 'ADVANCED', 'PROFESSIONAL');

-- PARTNERSHIP and INTERNATIONAL are removed from the product. Their groups are
-- folded into OTHER as a product decision — see docs/domain-rules.md.
UPDATE "Group" SET "type" = 'OTHER'
WHERE "type" IN ('PARTNERSHIP', 'INTERNATIONAL');
