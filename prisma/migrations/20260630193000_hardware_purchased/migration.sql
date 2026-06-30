-- AlterTable
ALTER TABLE "HardwareItem" ADD COLUMN "purchased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HardwareItem" ADD COLUMN "purchasedAt" DATETIME;
