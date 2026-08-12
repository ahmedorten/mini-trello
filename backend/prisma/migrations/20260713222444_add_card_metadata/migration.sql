-- CreateEnum
CREATE TYPE "CardPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "due_date" TIMESTAMPTZ,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "CardPriority" NOT NULL DEFAULT 'MEDIUM';
