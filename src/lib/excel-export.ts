import * as XLSX from "xlsx";

export type ExportPartRow = {
  specNumber?: number | null;
  name: string;
  code?: string | null;
  length?: string | null;
  width?: string | null;
  dimensions?: string | null;
  quantity: number;
  material?: string | null;
  edging?: string | null;
  groove?: string | null;
  rectangular?: string | null;
};

export type ExportHardwareRow = {
  specNumber?: number | null;
  code?: string | null;
  name: string;
  quantity: number;
  unit?: string | null;
};

export type ExportProduct = {
  number: string;
  name: string;
  parts: ExportPartRow[];
  hardware: ExportHardwareRow[];
};

export type ExportOrder = {
  number: string;
  title?: string | null;
  products: ExportProduct[];
};

function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || "Лист";
}

function uniqueSheetName(base: string, used: Set<string>): string {
  let name = sanitizeSheetName(base);
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  for (let i = 2; i < 100; i++) {
    const candidate = sanitizeSheetName(`${base.slice(0, 28)} ${i}`);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = sanitizeSheetName(`Лист ${used.size + 1}`);
  used.add(fallback);
  return fallback;
}

function partDimensions(part: ExportPartRow): { length: string; width: string } {
  if (part.length || part.width) {
    return { length: part.length ?? "", width: part.width ?? "" };
  }
  if (!part.dimensions) return { length: "", width: "" };
  const norm = part.dimensions.replace(/×/g, "x").trim();
  const match = norm.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)$/i);
  if (match) return { length: match[1].replace(",", "."), width: match[2].replace(",", ".") };
  return { length: norm, width: "" };
}

function productMetaRows(orderNumber: string, product: ExportProduct) {
  return [
    ["", "Заказ", "", orderNumber],
    ["", "Изделие", "", `${product.number} ${product.name}`.trim()],
    ["", "Артикул изделия", "", product.number],
  ];
}

function buildMaterialSectionRows(
  orderNumber: string,
  product: ExportProduct,
  material: string,
  parts: ExportPartRow[],
): (string | number)[][] {
  const rows: (string | number)[][] = [
    ...productMetaRows(orderNumber, product),
    ["", `Спецификация на ${material}`],
    [],
    ["№", "Поз.", "Наименование", "Готовая деталь", "", "Кол-во", "Облицовка", "Паз", "Прямоуг."],
    ["", "", "", "Длина", "Ширина", "", "", "", ""],
  ];

  parts.forEach((part, index) => {
    const { length, width } = partDimensions(part);
    rows.push([
      part.specNumber ?? index + 1,
      part.code ?? "",
      part.name,
      length,
      width,
      part.quantity,
      part.edging ?? "",
      part.groove ?? "",
      part.rectangular ?? "",
    ]);
  });

  return rows;
}

function buildHardwareSectionRows(
  orderNumber: string,
  product: ExportProduct,
  hardware: ExportHardwareRow[],
): (string | number)[][] {
  const rows: (string | number)[][] = [
    ...productMetaRows(orderNumber, product),
    ["", "Спецификация на фурнитуру"],
    [],
    ["№", "Артикул", "Наименование", "Кол-во", "Ед."],
  ];

  hardware.forEach((item, index) => {
    rows.push([
      item.specNumber ?? index + 1,
      item.code ?? "",
      item.name,
      item.quantity,
      item.unit ?? "",
    ]);
  });

  return rows;
}

function groupPartsByMaterial(parts: ExportPartRow[]): Map<string, ExportPartRow[]> {
  const map = new Map<string, ExportPartRow[]>();
  for (const part of parts) {
    const key = part.material?.trim() || "Без материала";
    const list = map.get(key) ?? [];
    list.push(part);
    map.set(key, list);
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru")));
}

/** Листы Excel: отдельный лист на каждый материал + лист фурнитуры */
export function buildSplitSpecificationWorkbook(order: ExportOrder): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const product of order.products) {
    const materials = groupPartsByMaterial(product.parts);

    for (const [material, parts] of materials) {
      const sheetName = uniqueSheetName(`${product.number} ${material}`.trim(), usedNames);
      const rows = buildMaterialSectionRows(order.number, product, material, parts);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
    }

    if (product.hardware.length > 0) {
      const sheetName = uniqueSheetName(`Фурнитура ${product.number}`, usedNames);
      const rows = buildHardwareSectionRows(order.number, product, product.hardware);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
    }
  }

  if (workbook.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Нет деталей и фурнитуры для выгрузки"]]),
      "Пусто",
    );
  }

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Один лист в формате Базис: секции материалов подряд, затем фурнитура */
export function buildBazisSpecificationWorkbook(order: ExportOrder): ArrayBuffer {
  const rows: (string | number)[][] = [];

  for (const product of order.products) {
    const materials = groupPartsByMaterial(product.parts);

    for (const [material, parts] of materials) {
      rows.push(...buildMaterialSectionRows(order.number, product, material, parts));
      rows.push([]);
    }

    if (product.hardware.length > 0) {
      rows.push(...buildHardwareSectionRows(order.number, product, product.hardware));
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [["Пусто"]]),
    "Спецификация",
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
