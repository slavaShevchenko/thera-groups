-- AlterTable
ALTER TABLE "Group" ADD COLUMN "priceAmount" DECIMAL(10,2);

-- Migrate existing numeric price values to priceAmount
-- The price column is DOUBLE PRECISION in the actual database
UPDATE "Group"
SET "priceAmount" = "price"
WHERE "price" IS NOT NULL;
