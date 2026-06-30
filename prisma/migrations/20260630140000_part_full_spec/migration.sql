-- AlterTable
ALTER TABLE "Part" ADD COLUMN "specNumber" INTEGER;
ALTER TABLE "Part" ADD COLUMN "length" TEXT;
ALTER TABLE "Part" ADD COLUMN "width" TEXT;
ALTER TABLE "Part" ADD COLUMN "edging" TEXT;
ALTER TABLE "Part" ADD COLUMN "groove" TEXT;
ALTER TABLE "Part" ADD COLUMN "rectangular" TEXT;

-- AlterTable
ALTER TABLE "HardwareItem" ADD COLUMN "specNumber" INTEGER;
