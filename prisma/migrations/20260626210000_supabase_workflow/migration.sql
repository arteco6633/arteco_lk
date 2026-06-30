-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCUREMENT', 'PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'SUPABASE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'NEW';

-- AlterTable: documents can belong to order OR product
ALTER TABLE "Document" ADD COLUMN "orderId" TEXT;
ALTER TABLE "Document" ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "Document" ALTER COLUMN "productId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_orderId_idx" ON "Document"("orderId");
CREATE INDEX "Document_productId_idx" ON "Document"("productId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one owner: order or product
ALTER TABLE "Document" ADD CONSTRAINT "Document_owner_check" CHECK (
  ("orderId" IS NOT NULL AND "productId" IS NULL) OR
  ("orderId" IS NULL AND "productId" IS NOT NULL)
);

-- =============================================================================
-- Представления для Supabase Table Editor — по одному «экрану» на этап
-- =============================================================================

CREATE OR REPLACE VIEW vw_orders AS
SELECT
  o.id,
  o.number,
  o.title,
  o.notes,
  o.status,
  o."createdAt",
  o."updatedAt",
  COUNT(DISTINCT p.id) AS product_count,
  COUNT(DISTINCT pt.id) AS part_count,
  COUNT(DISTINCT h.id) AS hardware_count,
  COUNT(DISTINCT d.id) FILTER (WHERE d."orderId" IS NOT NULL) AS order_document_count,
  COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'PACKED') AS parts_packed,
  COUNT(DISTINCT h.id) FILTER (WHERE h.purchased = true) AS hardware_purchased
FROM "Order" o
LEFT JOIN "Product" p ON p."orderId" = o.id
LEFT JOIN "Part" pt ON pt."productId" = p.id
LEFT JOIN "HardwareItem" h ON h."productId" = p.id
LEFT JOIN "Document" d ON d."orderId" = o.id
GROUP BY o.id;

CREATE OR REPLACE VIEW vw_documents AS
SELECT
  d.id,
  d.type,
  d.filename,
  d.filepath,
  d."storageProvider",
  d."uploadedAt",
  d."orderId",
  d."productId",
  o.number AS order_number,
  pr.number AS product_number,
  pr.name AS product_name,
  CASE
    WHEN d."orderId" IS NOT NULL THEN 'order'
    ELSE 'product'
  END AS owner_type
FROM "Document" d
LEFT JOIN "Order" o ON d."orderId" = o.id
LEFT JOIN "Product" pr ON d."productId" = pr.id;

CREATE OR REPLACE VIEW vw_stage_procurement AS
SELECT
  h.id,
  h."specNumber",
  h.code,
  h.name,
  h.quantity,
  h.unit,
  h.purchased,
  h."purchasedAt",
  h.packed,
  p.id AS product_id,
  p.number AS product_number,
  p.name AS product_name,
  o.id AS order_id,
  o.number AS order_number,
  o.status AS order_status
FROM "HardwareItem" h
JOIN "Product" p ON h."productId" = p.id
JOIN "Order" o ON p."orderId" = o.id
WHERE h.purchased = false;

CREATE OR REPLACE VIEW vw_stage_receipt AS
SELECT
  pt.id,
  pt."specNumber",
  pt.name,
  pt.code,
  pt.module,
  pt.material,
  pt.quantity,
  pt.dimensions,
  pt.status,
  pt."receivedAt",
  p.id AS product_id,
  p.number AS product_number,
  p.name AS product_name,
  o.id AS order_id,
  o.number AS order_number
FROM "Part" pt
JOIN "Product" p ON pt."productId" = p.id
JOIN "Order" o ON p."orderId" = o.id
WHERE pt.status = 'CREATED';

CREATE OR REPLACE VIEW vw_stage_sort AS
SELECT
  pt.id,
  pt."specNumber",
  pt.name,
  pt.code,
  pt.module,
  pt.material,
  pt.quantity,
  pt.status,
  pt."receivedAt",
  pt."sortedAt",
  p.id AS product_id,
  p.number AS product_number,
  p.name AS product_name,
  o.id AS order_id,
  o.number AS order_number
FROM "Part" pt
JOIN "Product" p ON pt."productId" = p.id
JOIN "Order" o ON p."orderId" = o.id
WHERE pt.status = 'RECEIVED';

CREATE OR REPLACE VIEW vw_stage_drill AS
SELECT
  pt.id,
  pt."specNumber",
  pt.name,
  pt.code,
  pt.module,
  pt.dimensions,
  pt.status,
  pt."sortedAt",
  pt."drilledAt",
  pt."drillPhotoPath",
  p.id AS product_id,
  p.number AS product_number,
  p.name AS product_name,
  o.id AS order_id,
  o.number AS order_number
FROM "Part" pt
JOIN "Product" p ON pt."productId" = p.id
JOIN "Order" o ON p."orderId" = o.id
WHERE pt.status = 'SORTED';

CREATE OR REPLACE VIEW vw_stage_qc AS
SELECT
  pt.id,
  pt."specNumber",
  pt.name,
  pt.code,
  pt.module,
  pt.status,
  pt."drilledAt",
  pt."qcAt",
  pt."qcComment",
  p.id AS product_id,
  p.number AS product_number,
  p.name AS product_name,
  o.id AS order_id,
  o.number AS order_number
FROM "Part" pt
JOIN "Product" p ON pt."productId" = p.id
JOIN "Order" o ON p."orderId" = o.id
WHERE pt.status = 'DRILLED';

CREATE OR REPLACE VIEW vw_stage_pack AS
SELECT
  pt.id,
  pt."specNumber",
  pt.name,
  pt.code,
  pt.module,
  pt.status,
  pt."qcAt",
  pt."packedAt",
  p.id AS product_id,
  p.number AS product_number,
  p.name AS product_name,
  o.id AS order_id,
  o.number AS order_number
FROM "Part" pt
JOIN "Product" p ON pt."productId" = p.id
JOIN "Order" o ON p."orderId" = o.id
WHERE pt.status = 'QC_PASSED';

COMMENT ON VIEW vw_orders IS 'Заказы со сводкой по изделиям, деталям и документам';
COMMENT ON VIEW vw_documents IS 'Все документы (уровень заказа и изделия)';
COMMENT ON VIEW vw_stage_procurement IS 'Этап: Закупка — незакупленная фурнитура';
COMMENT ON VIEW vw_stage_receipt IS 'Этап: Приёмка — детали со статусом CREATED';
COMMENT ON VIEW vw_stage_sort IS 'Этап: Сортировка — детали RECEIVED';
COMMENT ON VIEW vw_stage_drill IS 'Этап: Присадка — детали SORTED';
COMMENT ON VIEW vw_stage_qc IS 'Этап: ОКК — детали DRILLED';
COMMENT ON VIEW vw_stage_pack IS 'Этап: Упаковка — детали QC_PASSED';
