-- CreateTable
CREATE TABLE "Specialization" (
    "id" TEXT NOT NULL,
    "nameUa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialization_slug_key" ON "Specialization"("slug");

-- CreateIndex
CREATE INDEX "Specialization_slug_idx" ON "Specialization"("slug");

-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN "customSpecializations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: many-to-many join table
CREATE TABLE "_OrganizerProfileToSpecialization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_OrganizerProfileToSpecialization_AB_unique" ON "_OrganizerProfileToSpecialization"("A", "B");

-- CreateIndex
CREATE INDEX "_OrganizerProfileToSpecialization_B_index" ON "_OrganizerProfileToSpecialization"("B");

-- AddForeignKey
ALTER TABLE "_OrganizerProfileToSpecialization" ADD CONSTRAINT "_OrganizerProfileToSpecialization_A_fkey" FOREIGN KEY ("A") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizerProfileToSpecialization" ADD CONSTRAINT "_OrganizerProfileToSpecialization_B_fkey" FOREIGN KEY ("B") REFERENCES "Specialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
