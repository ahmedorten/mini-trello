-- CreateEnum
CREATE TYPE "InteractionDeliveryStatus" AS ENUM ('LOGGED', 'RECEIVED', 'QUEUED', 'SENT', 'FAILED');

-- DropForeignKey
ALTER TABLE "customer_interactions" DROP CONSTRAINT "customer_interactions_created_by_id_fkey";

-- AlterTable
ALTER TABLE "customer_interactions" ADD COLUMN     "channel_address" TEXT,
ADD COLUMN     "delivery_status" "InteractionDeliveryStatus" NOT NULL DEFAULT 'LOGGED',
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "thread_key" TEXT,
ALTER COLUMN "created_by_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "customer_interactions_customer_id_channel_thread_key_idx" ON "customer_interactions"("customer_id", "channel", "thread_key");

-- CreateIndex
CREATE INDEX "customer_interactions_occurred_at_idx" ON "customer_interactions"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_interactions_channel_external_id_key" ON "customer_interactions"("channel", "external_id");

-- AddForeignKey
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

