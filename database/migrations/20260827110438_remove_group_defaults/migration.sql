-- Remove default from Group.type so new drafts have null type
ALTER TABLE "Group" ALTER COLUMN "type" DROP DEFAULT;
