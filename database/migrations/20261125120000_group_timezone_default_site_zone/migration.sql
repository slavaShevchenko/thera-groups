-- Group.timezone: default to the site zone instead of UTC, and move the rows the old
-- default produced.
--
-- `POST /api/groups` creates an empty DRAFT and never sends a timezone, so every group
-- created through the site was born with whatever this column defaulted to. That was 'UTC',
-- which is not one of the 87 zones the edit form offers (its options are the keys of the
-- `timezones` locale dictionary), so the value could not be seen or corrected: the select
-- rendered empty while still holding 'UTC' and saved it back on every edit, and the group
-- page printed the raw lookup key `timezones.UTC`, because `t()` answers with the key itself
-- when a translation is missing.
--
-- 'Europe/Kyiv' is the zone the rest of the code already treats as the default —
-- `SITE_TIMEZONE` in server/utils/siteTime.ts, the fallback in `formatTime()`, the initial
-- value in `useGroupForm`, and what database/seed.ts writes into every seeded group.
--
-- The backfill is safe to run unconditionally: no UI could ever have written 'UTC' as a
-- choice, so a row holding it holds the old default and not an organizer's decision.
-- "startsAt"/"endsAt" are untouched — this changes the zone the stored instants are read in,
-- not the instants themselves.
ALTER TABLE "Group" ALTER COLUMN "timezone" SET DEFAULT 'Europe/Kyiv';

UPDATE "Group" SET "timezone" = 'Europe/Kyiv' WHERE "timezone" = 'UTC';
