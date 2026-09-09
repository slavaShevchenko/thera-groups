-- AlterTable: make Group.type nullable to match Prisma schema
ALTER TABLE "Group" ALTER COLUMN "type" DROP NOT NULL;
