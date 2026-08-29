-- CreateTable
CREATE TABLE "GroupCoOrganizer" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupCoOrganizer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupCoOrganizer_groupId_userId_key" ON "GroupCoOrganizer"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupCoOrganizer_groupId_idx" ON "GroupCoOrganizer"("groupId");

-- AddForeignKey
ALTER TABLE "GroupCoOrganizer" ADD CONSTRAINT "GroupCoOrganizer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCoOrganizer" ADD CONSTRAINT "GroupCoOrganizer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
