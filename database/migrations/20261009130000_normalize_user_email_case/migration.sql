-- One canonical spelling for every stored address.
--
-- "User".email is @unique and every lookup goes through findUnique({ where: { email } }),
-- which PostgreSQL resolves byte-for-byte, while GoTrue stores addresses lower-cased and
-- matches them case-insensitively. The two disagreed, and the disagreement was not
-- cosmetic: register.post.ts reads a missing "User" row as "the database half of an
-- earlier sign-up failed" and deletes the auth.users record to make room. A row stored as
-- 'User@Example.com' was invisible to a sign-up attempt for 'user@example.com', so that
-- attempt deleted a live account and re-created it under the attacker's password.
--
-- The application now normalizes on the way in (server/utils/emailAddress.ts). This folds
-- the rows that are already stored, so no mixed-case address is left to be mistaken for an
-- orphan.
--
-- Rows that cannot be folded are skipped rather than forced. Two rows can only collide if
-- the same address is stored twice in different cases, which means two accounts already
-- share one address; picking a survivor is a decision for an operator, not for a
-- migration. Skipping is also safe now that the readers normalize: the lower-cased twin
-- answers every lookup, so the mixed-case row becomes unreachable instead of dangerous.
--
-- To list what was skipped, run this after deploying:
--
--   SELECT u.id, u.email
--   FROM "User" u
--   WHERE u.email <> LOWER(BTRIM(u.email));
WITH normalized AS (
  SELECT id, LOWER(BTRIM(email)) AS canonical
  FROM "User"
  WHERE email <> LOWER(BTRIM(email))
),
taken AS (
  SELECT canonical
  FROM (
    SELECT canonical FROM normalized
    UNION ALL
    SELECT email FROM "User" WHERE email = LOWER(BTRIM(email))
  ) candidates
  GROUP BY canonical
  HAVING COUNT(*) > 1
)
UPDATE "User" u
SET email = n.canonical,
    "updatedAt" = NOW()
FROM normalized n
WHERE u.id = n.id
  AND n.canonical NOT IN (SELECT canonical FROM taken);
