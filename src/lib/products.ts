import type { HardwareItem, Part, Product } from "@prisma/client";
import { normalizeProductNumber } from "./excel";

type ProductWithRelations = {
  parts: Array<Pick<Part, "status">>;
  hardware: Array<Pick<HardwareItem, "packed">>;
};

export function findProductByNumber(
  products: Product[],
  productNumber: string,
): Product | undefined {
  const normalized = normalizeProductNumber(productNumber);
  return products.find((p) => normalizeProductNumber(p.number) === normalized);
}

/** Привязка строки импорта к изделию: по номеру, названию из спецификации или единственному изделию */
export function findProductForImport(
  products: Product[],
  row: { productNumber: string; productName?: string },
): Product | undefined {
  const byNumber = findProductByNumber(products, row.productNumber);
  if (byNumber) return byNumber;

  if (products.length === 1) return products[0];

  if (row.productName) {
    const needle = row.productName.toLowerCase().replace(/\s+/g, " ").trim();
    const byName = products.find((p) => {
      const hay = p.name.toLowerCase().replace(/\s+/g, " ").trim();
      return hay.includes(needle) || needle.includes(hay);
    });
    if (byName) return byName;

    const leading = row.productName.match(/^(\d+)/)?.[1];
    if (leading) {
      const byLeading = findProductByNumber(products, leading);
      if (byLeading) return byLeading;
    }
  }

  return undefined;
}

export function productNeedsPacking(product: ProductWithRelations): boolean {
  if (product.parts.length === 0) return false;

  const hasPartsToPack = product.parts.some((p) => p.status === "QC_PASSED");
  const hasUnpackedHardware = product.hardware.some((h) => !h.packed);
  const allPartsReady = product.parts.every(
    (p) => p.status === "QC_PASSED" || p.status === "PACKED",
  );

  if (hasPartsToPack) return true;
  if (hasUnpackedHardware && allPartsReady) return true;

  return false;
}
