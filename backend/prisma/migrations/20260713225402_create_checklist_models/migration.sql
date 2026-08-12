-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_ITEM_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_ITEM_COMPLETED';
ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_ITEM_UNCOMPLETED';
ALTER TYPE "ActivityAction" ADD VALUE 'CHECKLIST_ITEM_DELETED';

-- CreateTable
CREATE TABLE "checklists" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklists_card_id_is_deleted_idx" ON "checklists"("card_id", "is_deleted");

-- CreateIndex
CREATE INDEX "checklist_items_checklist_id_is_deleted_idx" ON "checklist_items"("checklist_id", "is_deleted");

-- CreateIndex
CREATE INDEX "checklist_items_checklist_id_position_idx" ON "checklist_items"("checklist_id", "position");

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
