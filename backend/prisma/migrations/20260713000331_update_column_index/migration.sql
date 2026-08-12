-- DropIndex
DROP INDEX "columns_board_id_idx";

-- CreateIndex
CREATE INDEX "columns_board_id_is_deleted_idx" ON "columns"("board_id", "is_deleted");
