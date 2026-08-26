-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InteractionChannel" ADD VALUE 'WHATSAPP';
ALTER TYPE "InteractionChannel" ADD VALUE 'SMS';
ALTER TYPE "InteractionChannel" ADD VALUE 'WEB_FORM';

-- AlterTable
ALTER TABLE "customer_interactions" ADD COLUMN     "ticket_id" UUID;

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'OPEN',
    "due_at" TIMESTAMP(3),
    "remind_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assignee_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "ticket_id" UUID,
    "customer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "InteractionChannel",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_tasks_assignee_id_status_idx" ON "agent_tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "agent_tasks_assignee_id_due_at_idx" ON "agent_tasks"("assignee_id", "due_at");

-- CreateIndex
CREATE INDEX "agent_tasks_ticket_id_idx" ON "agent_tasks"("ticket_id");

-- CreateIndex
CREATE INDEX "agent_tasks_customer_id_idx" ON "agent_tasks"("customer_id");

-- CreateIndex
CREATE INDEX "quick_replies_locale_is_active_idx" ON "quick_replies"("locale", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "quick_replies_key_locale_key" ON "quick_replies"("key", "locale");

-- CreateIndex
CREATE INDEX "customer_interactions_ticket_id_occurred_at_idx" ON "customer_interactions"("ticket_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
