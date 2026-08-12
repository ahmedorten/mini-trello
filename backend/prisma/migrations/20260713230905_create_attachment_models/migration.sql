-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'ATTACHMENT_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'ATTACHMENT_DELETED';

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(1000) NOT NULL,
    "file_size" INTEGER,
    "mimetype" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_card_id_is_deleted_idx" ON "attachments"("card_id", "is_deleted");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
