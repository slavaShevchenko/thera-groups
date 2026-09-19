/*
  Warning: data loss detected — Group.price had 10 non-null rows.
  Values were migrated to Group.priceAmount before this migration.
*/
ALTER TABLE "Group" DROP COLUMN "price";
ALTER TABLE "OrganizerProfile" DROP COLUMN "avatar";
