import type { CatalogItemType, Prisma } from "@prisma/client";

export type CatalogListFilters = {
  categoryId?: string;
  type?: CatalogItemType;
  q?: string;
};

export function buildCatalogItemWhere(filters: CatalogListFilters): Prisma.CatalogItemWhereInput {
  const q = filters.q?.trim();
  return {
    active: true,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { subcategory: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function parseCatalogPriceInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return null;
  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.round(num * 100) / 100;
}

export type MarkupTarget = "platePrice" | "costPrice" | "clientPrice";
export type MarkupMode = "percent" | "fixed";

export function applyMarkup(
  current: number | null | undefined,
  mode: MarkupMode,
  value: number,
): number | null {
  if (current === null || current === undefined) return null;
  if (mode === "percent") {
    return Math.round(current * (1 + value / 100) * 100) / 100;
  }
  return Math.round((current + value) * 100) / 100;
}

export function plateToSqmPrice(platePrice: number, sheetAreaSqm: number | null | undefined): number | null {
  if (!sheetAreaSqm || sheetAreaSqm <= 0) return null;
  return Math.round((platePrice / sheetAreaSqm) * 100) / 100;
}
