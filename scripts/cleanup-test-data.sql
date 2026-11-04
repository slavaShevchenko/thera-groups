-- ============================================================================
-- scripts/cleanup-test-data.sql
--
-- Removes development test data from the PRODUCTION database before launch.
--
--   Run it:   psql "$DATABASE_URL" -f scripts/cleanup-test-data.sql
--        or:  Supabase dashboard → SQL Editor → paste → Run
--
-- It refuses to do anything until the confirmation token in step 0 is set, and
-- it runs inside a single transaction, so a failure anywhere rolls back all of
-- it. Read the NOTICE output before committing.
--
-- What it removes
--   1. the organizers `asd-asd` and `qwe-qwe`, with their groups and everything
--      hanging off those groups
--   2. four VISITOR accounts left behind by the manual/e2e run of 2026-10-05
--      (beyond the two organizers the audit named — see step 1)
--   3. every `auth.users` row that has no `public."User"` row, which after steps
--      1-2 includes the auth accounts of the users just deleted
--   4. `EmailEvent` rows addressed to any of the above
--
-- What it never touches
--   • any ADMIN row, in either schema (step 1 aborts rather than delete one)
--   • `_prisma_migrations`
--   • storage blobs — see the note in step 6
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Safety gate
-- ────────────────────────────────────────────────────────────────────────────
-- Nothing below runs until `confirm` is edited to match. The date in the token
-- is the audit this script was written for; change it when the target set
-- changes, so a stale script cannot be run against a database it was never
-- measured against.
DO $$
DECLARE
  confirm    text := 'CHANGE-ME';
  admin_rows int;
BEGIN
  IF confirm <> 'DELETE-TEST-DATA-2026-11-02' THEN
    RAISE EXCEPTION
      'ABORTED: set `confirm` in step 0 of scripts/cleanup-test-data.sql to DELETE-TEST-DATA-2026-11-02';
  END IF;

  SELECT count(*) INTO admin_rows FROM public."User" WHERE role = 'ADMIN';

  IF admin_rows < 1 THEN
    RAISE EXCEPTION
      'ABORTED: this database has no ADMIN row, so it is not the database this script was written for';
  END IF;

  RAISE NOTICE 'gate passed — % ADMIN row(s) present, they are excluded from every step below', admin_rows;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. The exact set this script is allowed to touch
-- ────────────────────────────────────────────────────────────────────────────
-- Built once and reused, so every step below deletes from the same list rather
-- than re-deriving it. Deliberately explicit addresses and slugs, never a
-- pattern: `email LIKE '%test.com'` is how a cleanup once over-matched, and a
-- real customer could register `something@test.com` tomorrow.
CREATE TEMP TABLE _target_user ON COMMIT DROP AS
SELECT u.id, u.email, u.role
  FROM public."User" u
 WHERE u.id IN (
         SELECT p."userId"
           FROM public."OrganizerProfile" p
          WHERE p.slug IN ('asd-asd', 'qwe-qwe')
       )
    OR u.email IN (
         -- Manual/e2e residue from 2026-10-05. These own no rows of their own,
         -- but they are test accounts in a production catalog and each one keeps
         -- a Supabase auth identity alive that can sign back in.
         'test@example.com',
         'new-therapist@test.com',
         'new-org@test.com',
         'ui-check-1791204058175@example.com'
       );

-- Hard stop rather than a filter: if an ADMIN somehow matched, the lists above
-- are wrong and nothing should be deleted at all.
DO $$
DECLARE matched_admins int;
BEGIN
  SELECT count(*) INTO matched_admins FROM _target_user WHERE role = 'ADMIN';

  IF matched_admins > 0 THEN
    RAISE EXCEPTION 'ABORTED: % ADMIN row(s) matched the deletion set', matched_admins;
  END IF;
END $$;

-- Profiles and groups follow from the users, not from the slug list: a targeted
-- user may own a profile under a slug this script was never told about.
CREATE TEMP TABLE _target_profile ON COMMIT DROP AS
SELECT p.id, p.slug
  FROM public."OrganizerProfile" p
 WHERE p."userId" IN (SELECT id FROM _target_user);

CREATE TEMP TABLE _target_group ON COMMIT DROP AS
SELECT g.id, g.slug, g.status
  FROM public."Group" g
 WHERE g."organizerId" IN (SELECT id FROM _target_profile);

DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '── users to delete ──';
  FOR r IN SELECT email, role, id FROM _target_user ORDER BY role, email LOOP
    RAISE NOTICE '   % [%] %', r.email, r.role, r.id;
  END LOOP;

  RAISE NOTICE '── organizer profiles to delete ──';
  FOR r IN SELECT slug, id FROM _target_profile ORDER BY slug LOOP
    RAISE NOTICE '   % %', r.slug, r.id;
  END LOOP;

  RAISE NOTICE '── groups to delete ──';
  FOR r IN SELECT slug, status, id FROM _target_group ORDER BY status, slug LOOP
    RAISE NOTICE '   % [%] %', r.slug, r.status, r.id;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. What the cascade will take with the groups
-- ────────────────────────────────────────────────────────────────────────────
-- Counted before deleting, because after the parent is gone there is nothing
-- left to count and no way to tell whether the cascade fired.
DO $$
DECLARE
  g int; a int; ans int; q int; rev int; fav int; co int; tag int;
BEGIN
  SELECT count(*) INTO g   FROM _target_group;
  SELECT count(*) INTO a   FROM public."Application"         WHERE "groupId" IN (SELECT id FROM _target_group);
  SELECT count(*) INTO ans FROM public."ApplicationAnswer"   WHERE "applicationId" IN
                             (SELECT id FROM public."Application" WHERE "groupId" IN (SELECT id FROM _target_group));
  SELECT count(*) INTO q   FROM public."ApplicationQuestion" WHERE "groupId" IN (SELECT id FROM _target_group);
  SELECT count(*) INTO rev FROM public."Review"              WHERE "groupId" IN (SELECT id FROM _target_group);
  SELECT count(*) INTO fav FROM public."Favorite"            WHERE "groupId" IN (SELECT id FROM _target_group);
  SELECT count(*) INTO co  FROM public."GroupCoOrganizer"    WHERE "groupId" IN (SELECT id FROM _target_group);
  SELECT count(*) INTO tag FROM public."_GroupToGroupTag"    WHERE "A" IN (SELECT id FROM _target_group);

  RAISE NOTICE 'groups % → cascading: Application %, ApplicationAnswer %, ApplicationQuestion %, Review %, Favorite %, GroupCoOrganizer %, _GroupToGroupTag %',
    g, a, ans, q, rev, fav, co, tag;
END $$;

-- Group.organizerId is ON DELETE SET NULL, not CASCADE. Deleting the profile
-- first would leave its groups behind with no author -- still publicly visible
-- if any of them were PUBLISHED -- so the groups go explicitly, and every table
-- above follows them by CASCADE.
DELETE FROM public."Group" WHERE id IN (SELECT id FROM _target_group);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. The profiles, then the users
-- ────────────────────────────────────────────────────────────────────────────
-- Review.organizerId cascades from the profile; Notification, Report, Favorite,
-- Review and GroupCoOrganizer cascade from the user.
DELETE FROM public."OrganizerProfile" WHERE id IN (SELECT id FROM _target_profile);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public."Notification" WHERE "userId" IN (SELECT id FROM _target_user);
  RAISE NOTICE 'in-app Notification rows cascading from these users: %', n;
END $$;

DELETE FROM public."User" WHERE id IN (SELECT id FROM _target_user);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. EmailEvent
-- ────────────────────────────────────────────────────────────────────────────
-- No foreign key: `recipient` is a plain address, so these rows outlive the user
-- they were sent to. Removed because they are the delivery log of test traffic
-- and would otherwise be the only test data left in the database.
DO $$
DECLARE n int;
BEGIN
  CREATE TEMP TABLE _target_email ON COMMIT DROP AS
  SELECT email FROM _target_user
  UNION
  -- The seed's default sender, which reached a mailbox nobody owns.
  SELECT unnest(ARRAY['admin@example.com', 'organizer@example.com']);

  SELECT count(*) INTO n FROM public."EmailEvent"
   WHERE recipient IN (SELECT email FROM _target_email);

  RAISE NOTICE 'EmailEvent rows to delete: %', n;
END $$;

DELETE FROM public."EmailEvent"
 WHERE recipient IN (SELECT email FROM _target_user)
    OR recipient IN ('admin@example.com', 'organizer@example.com');

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Supabase auth identities
-- ────────────────────────────────────────────────────────────────────────────
-- This step is the reason the script cannot stop at the public schema. Deleting
-- a `public."User"` and leaving its `auth.users` row behind means the address can
-- still sign in: `getUser()` auto-provisions a fresh VISITOR row on the next
-- request, and the test account is back.
--
-- Scoped by "has no local row", never by email pattern. Of the 74 orphans
-- measured on 2026-11-02 only 64 matched `%test.com` -- the other ten were
-- @qwe.com, @asd.com, @example.com and similar, which a pattern would have
-- quietly left in place.
--
-- Runs after step 3 so the accounts of the users just deleted are orphans too.
-- Every child table in the auth schema (identities, sessions, refresh_tokens,
-- one_time_tokens, mfa_*, oauth_*, webauthn_*) is ON DELETE CASCADE from
-- auth.users, so one delete cleans the whole identity.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM auth.users a
   WHERE NOT EXISTS (SELECT 1 FROM public."User" u WHERE u."authId" = a.id::text)
     -- An address that still has a local row is somebody's account even if the
     -- link column was never filled in.
     AND NOT EXISTS (SELECT 1 FROM public."User" u2 WHERE lower(u2.email) = lower(a.email))
     -- A sign-up in flight has an auth row before its first request creates the
     -- local one. One hour is far longer than that window.
     AND a.created_at < now() - interval '1 hour';

  RAISE NOTICE 'auth.users orphans to delete: %', n;
END $$;

DELETE FROM auth.users a
 WHERE NOT EXISTS (SELECT 1 FROM public."User" u WHERE u."authId" = a.id::text)
   AND NOT EXISTS (SELECT 1 FROM public."User" u2 WHERE lower(u2.email) = lower(a.email))
   AND a.created_at < now() - interval '1 hour';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Counters, empty tables, and the one thing this script cannot do
-- ────────────────────────────────────────────────────────────────────────────
-- Review, Report and Favorite were verified empty (0 rows each) on 2026-11-02,
-- and steps 2-3 remove any row that belonged to a deleted user or group in any
-- case. There is nothing to truncate.
--
-- There are also no counters to reset: every primary key in this schema is a
-- cuid() string, and `pg_class` shows zero sequences owned by a public table.
-- A `TRUNCATE ... RESTART IDENTITY` here would be a no-op at best.
DO $$
DECLARE rev int; rep int; fav int; seq int;
BEGIN
  SELECT count(*) INTO rev FROM public."Review";
  SELECT count(*) INTO rep FROM public."Report";
  SELECT count(*) INTO fav FROM public."Favorite";

  SELECT count(*) INTO seq
    FROM pg_class s
    JOIN pg_namespace n ON n.oid = s.relnamespace
   WHERE s.relkind = 'S' AND n.nspname = 'public';

  RAISE NOTICE 'remaining Review %, Report %, Favorite %; sequences owned by public tables: %',
    rev, rep, fav, seq;
END $$;

-- NOTE — avatar files are NOT deleted here, on purpose.
--
-- `storage.objects` rows for the removed users survive this script:
--   cmuzpqc340006ugxv8phr9pnj-1791588311150.jpg   (1@2.com / qwe-qwe)
--   cmvz0rbzo0005z3xv49bt85r1-1793609672976.jpg   (asd@asd.com / asd-asd)
-- plus six older ones whose cuid prefix matches no current user.
--
-- Deleting the metadata row alone orphans the blob in the underlying store,
-- which is worse than leaving it. Remove them through the Storage API or the
-- dashboard instead:
--   supabase storage rm organizer-avatars --paths "<name>"
-- or Storage → Buckets → organizer-avatars in the dashboard.

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Expected end state — compare against the NOTICEs above before committing
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '── state after cleanup ──';
  FOR r IN
    SELECT 'User' AS t, count(*) AS n FROM public."User"
    UNION ALL SELECT 'OrganizerProfile', count(*) FROM public."OrganizerProfile"
    UNION ALL SELECT 'Group', count(*) FROM public."Group"
    UNION ALL SELECT 'Application', count(*) FROM public."Application"
    UNION ALL SELECT 'Notification', count(*) FROM public."Notification"
    UNION ALL SELECT 'EmailEvent', count(*) FROM public."EmailEvent"
    UNION ALL SELECT 'auth.users', count(*) FROM auth.users
    ORDER BY 1
  LOOP
    RAISE NOTICE '   % = %', r.t, r.n;
  END LOOP;

  RAISE NOTICE 'ADMIN rows surviving: %', (SELECT count(*) FROM public."User" WHERE role = 'ADMIN');
END $$;

-- Review every NOTICE above, then commit. To back out instead, run ROLLBACK;
-- in place of the COMMIT below.
COMMIT;
