-- Индексы для быстрых фильтров по этапам workflow
CREATE INDEX IF NOT EXISTS "Part_status_idx" ON "Part"("status");
CREATE INDEX IF NOT EXISTS "Part_productId_status_idx" ON "Part"("productId", "status");
CREATE INDEX IF NOT EXISTS "Part_code_idx" ON "Part"("code");
