-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CARD_CREATED', 'CARD_UPDATED', 'CARD_DELETED', 'CARD_MOVED', 'CARD_ARCHIVED', 'CARD_UNARCHIVED', 'COMMENT_CREATED', 'COMMENT_UPDATED', 'COMMENT_DELETED', 'LABEL_ATTACHED', 'LABEL_DETACHED');

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_card_id_idx" ON "activities"("card_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
