-- AlterTable: make draft fields nullable for empty group creation
ALTER TABLE "Group" ALTER COLUMN "categoryId" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "format" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "startsAt" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "endsAt" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "capacity" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "price" DROP NOT NULL;
