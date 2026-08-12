-- DropIndex
DROP INDEX "cards_column_id_position_key";

-- CreateIndex
CREATE INDEX "cards_column_id_position_idx" ON "cards"("column_id", "position");
