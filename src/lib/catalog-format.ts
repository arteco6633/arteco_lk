import type { CatalogItemType, CatalogPriceUnit } from "@prisma/client";

export function formatCatalogPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCatalogDimension(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  }).format(value);
}

export function primaryPriceLabel(
  type: CatalogItemType,
  unit: CatalogPriceUnit,
): { cost?: string; client?: string; plate?: string } {
  if (type === "BOARD") {
    return {
      plate: "Цена листа",
      cost: "Себес, м²",
      client: "Клиенту, м²",
    };
  }
  if (unit === "METER") return { client: "Цена, п.м" };
  if (unit === "KG") return { client: "Цена, кг" };
  return { client: "Цена" };
}
