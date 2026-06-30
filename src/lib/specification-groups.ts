import type { PartStatus } from "@prisma/client";

export type SpecificationPart = {
  id: string;
  specNumber: number | null;
  name: string;
  code: string | null;
  material: string | null;
  sectionOrder: number | null;
  length: string | null;
  width: string | null;
  dimensions?: string | null;
  quantity: number;
  edging?: string | null;
  groove?: string | null;
  rectangular?: string | null;
  status: PartStatus;
};

export type SpecificationHardware = {
  id: string;
  specNumber: number | null;
  code: string | null;
  name: string;
  quantity: number;
  unit: string | null;
};

export type MaterialSection<T extends SpecificationPart = SpecificationPart> = {
  title: string;
  material: string;
  sectionOrder: number;
  parts: T[];
};

export function assignSectionOrder<T extends { material?: string }>(rows: T[]): Array<T & { sectionOrder: number }> {
  const seen = new Map<string, number>();
  let counter = 0;
  return rows.map((row) => {
    const key = row.material?.trim() || "__none__";
    if (!seen.has(key)) {
      counter += 1;
      seen.set(key, counter);
    }
    return { ...row, sectionOrder: seen.get(key)! };
  });
}

export function groupPartsByMaterialSection<T extends SpecificationPart>(
  parts: T[],
): MaterialSection<T>[] {
  const map = new Map<string, MaterialSection>();

  for (const part of parts) {
    const material = part.material?.trim() || "Без материала";
    const sectionOrder = part.sectionOrder ?? 9999;
    const key = `${sectionOrder}::${material}`;

    if (!map.has(key)) {
      map.set(key, {
        title: `Спецификация на ${material}`,
        material,
        sectionOrder,
        parts: [],
      });
    }
    map.get(key)!.parts.push(part);
  }

  return [...map.values()]
    .sort((a, b) => a.sectionOrder - b.sectionOrder || a.material.localeCompare(b.material, "ru"))
    .map((section) => ({
      ...section,
      parts: [...section.parts].sort((a, b) => {
        const aNum = a.specNumber ?? Number.MAX_SAFE_INTEGER;
        const bNum = b.specNumber ?? Number.MAX_SAFE_INTEGER;
        if (aNum !== bNum) return aNum - bNum;
        return a.name.localeCompare(b.name, "ru");
      }) as T[],
    }));
}

export function sortHardwareItems<T extends SpecificationHardware>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aNum = a.specNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.specNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return a.name.localeCompare(b.name, "ru");
  });
}

export type GroupedProductSections<T extends SpecificationPart> = {
  product: { id: string; number: string; name: string };
  sections: MaterialSection[];
};

export function groupPartsByProductAndSection<T extends SpecificationPart & {
  product: { id: string; number: string; name: string };
}>(parts: T[]): GroupedProductSections<T>[] {
  const byProduct = new Map<string, { product: T["product"]; parts: T[] }>();

  for (const part of parts) {
    const existing = byProduct.get(part.product.id);
    if (existing) {
      existing.parts.push(part);
    } else {
      byProduct.set(part.product.id, { product: part.product, parts: [part] });
    }
  }

  return [...byProduct.values()]
    .sort((a, b) => a.product.number.localeCompare(b.product.number, "ru", { numeric: true }))
    .map(({ product, parts: productParts }) => ({
      product,
      sections: groupPartsByMaterialSection(productParts),
    }));
}
