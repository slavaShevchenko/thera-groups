-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_categoryId_fkey";

-- DropIndex
DROP INDEX "Group_categoryId_idx";

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "GroupCategory";
