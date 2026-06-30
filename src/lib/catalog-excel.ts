import "server-only";
import * as XLSX from "xlsx";
import type { CatalogItemType, CatalogPriceUnit } from "@prisma/client";

export type ParsedCatalogItem = {
  sheetName: string;
  subcategory?: string;
  name: string;
  code?: string;
  type: CatalogItemType;
  unit: CatalogPriceUnit;
  platePrice?: number;
  heightM?: number;
  widthM?: number;
  sheetAreaSqm?: number;
  costPrice?: number;
  clientPrice?: number;
  link?: string;
  sourceRow: number;
};

export type CatalogParseResult = {
  sheets: Array<{ name: string; type: CatalogItemType; items: ParsedCatalogItem[] }>;
  skipped: number;
  errors: string[];
};

type ColumnMap = {
  name: number;
  code: number;
  platePrice: number;
  height: number;
  width: number;
  area: number;
  cost: number;
  client: number;
  price: number;
  unit: number;
  link: number;
};

const EMPTY_COL = -1;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/№/g, "номер ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(value).replace(".", ",");
  }
  return String(value).trim();
}

export function parseCatalogNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!raw || raw === "-") return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

function columnScore(header: string, matchers: string[]): number {
  const h = normalizeHeader(header);
  if (!h) return -1;
  let best = -1;
  for (const matcher of matchers) {
    const m = normalizeHeader(matcher);
    if (!m) continue;
    if (h === m) best = Math.max(best, 100);
    else if (h.includes(m) || m.includes(h)) best = Math.max(best, 50 + m.length);
  }
  return best;
}

function detectColumns(headers: string[]): ColumnMap {
  const pick = (matchers: string[]) => {
    let bestIdx = EMPTY_COL;
    let bestScore = 0;
    headers.forEach((h, i) => {
      const score = columnScore(h, matchers);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    return bestScore >= 40 ? bestIdx : EMPTY_COL;
  };

  return {
    name: pick(["название", "наименование", "материал", "name"]),
    code: pick(["артикул", "код", "sku", "article"]),
    platePrice: pick(["цена плиты", "цена листа", "стоимость листа", "plate"]),
    height: pick(["высота", "height"]),
    width: pick(["ширина", "width"]),
    area: pick(["площадь листа", "площадь", "area"]),
    cost: pick(["себес", "себестоимость", "закуп", "cost"]),
    client: pick(["стоимость клиенту", "клиенту", "розница", "продажа", "client"]),
    price: pick(["цена", "price", "стоимость"]),
    unit: pick(["ед", "единица", "unit"]),
    link: pick(["ссылка", "link", "url"]),
  };
}

export function inferCatalogTypeFromSheetName(name: string): CatalogItemType {
  const n = name.toLowerCase();
  if (/кромк|edge|пвх/.test(n)) return "EDGE";
  if (/фурнитур|петл|направл|ручк|ножк|крепеж|blum|hettich/.test(n)) return "HARDWARE";
  if (/услуг|работ|монтаж|достав/.test(n)) return "SERVICE";
  if (/лдсп|мдф|хдф|дсп|dsp|mdf|hdf|шпон|фанер|столешн/.test(n)) return "BOARD";
  return "OTHER";
}

function inferUnit(type: CatalogItemType, cols: ColumnMap, row: unknown[]): CatalogPriceUnit {
  if (cols.platePrice !== EMPTY_COL && parseCatalogNumber(row[cols.platePrice]) !== undefined) {
    return type === "BOARD" ? "SHEET" : "PIECE";
  }
  if (cols.client !== EMPTY_COL || cols.cost !== EMPTY_COL) {
    const headerHint = type === "BOARD" ? "SQM" : "PIECE";
    if (cols.unit !== EMPTY_COL) {
      const u = normalizeHeader(cellText(row[cols.unit]));
      if (/кв|м2|м²|sqm/.test(u)) return "SQM";
      if (/лист|плит/.test(u)) return "SHEET";
      if (/п\.?\s*м|метр/.test(u)) return "METER";
      if (/кг|kg/.test(u)) return "KG";
      if (/шт|piece/.test(u)) return "PIECE";
    }
    return headerHint as CatalogPriceUnit;
  }
  return type === "HARDWARE" ? "PIECE" : "OTHER";
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `sheet-${Date.now()}`
  );
}

export { slugify };

function isSubcategoryRow(row: unknown[], cols: ColumnMap): boolean {
  const name = cellText(row[cols.name !== EMPTY_COL ? cols.name : 0]);
  if (!name || name.length < 2) return false;

  const numericCols = [cols.platePrice, cols.height, cols.width, cols.area, cols.cost, cols.client, cols.price];
  const hasNumeric = numericCols.some((idx) => {
    if (idx === EMPTY_COL) return false;
    return parseCatalogNumber(row[idx]) !== undefined;
  });
  if (hasNumeric) return false;

  const onlyName =
    row.filter((cell, i) => {
      const text = cellText(cell);
      if (!text) return false;
      const nameCol = cols.name !== EMPTY_COL ? cols.name : 0;
      return i !== nameCol;
    }).length === 0;

  return onlyName || /^[а-яёa-z]/i.test(name);
}

function parseSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
  sheetIndex: number,
): { type: CatalogItemType; items: ParsedCatalogItem[]; skipped: number; errors: string[] } {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const errors: string[] = [];
  let skipped = 0;
  const items: ParsedCatalogItem[] = [];
  const type = inferCatalogTypeFromSheetName(sheetName);

  let headerRowIdx = -1;
  let cols: ColumnMap | null = null;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const headers = row.map((c) => cellText(c));
    const trial = detectColumns(headers);
    if (trial.name !== EMPTY_COL) {
      headerRowIdx = i;
      cols = trial;
      break;
    }
  }

  if (!cols || headerRowIdx === -1) {
    errors.push(`Лист «${sheetName}»: не найдена строка заголовков`);
    return { type, items, skipped: rows.length, errors };
  }

  let currentSubcategory: string | undefined;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const nameCol = cols.name !== EMPTY_COL ? cols.name : 0;
    const name = cellText(row[nameCol]);
    if (!name) {
      skipped++;
      continue;
    }

    if (isSubcategoryRow(row, cols)) {
      currentSubcategory = name;
      continue;
    }

    const platePrice =
      cols.platePrice !== EMPTY_COL ? parseCatalogNumber(row[cols.platePrice]) : undefined;
    const heightM = cols.height !== EMPTY_COL ? parseCatalogNumber(row[cols.height]) : undefined;
    const widthM = cols.width !== EMPTY_COL ? parseCatalogNumber(row[cols.width]) : undefined;
    let sheetAreaSqm = cols.area !== EMPTY_COL ? parseCatalogNumber(row[cols.area]) : undefined;
    const costPrice = cols.cost !== EMPTY_COL ? parseCatalogNumber(row[cols.cost]) : undefined;
    let clientPrice =
      cols.client !== EMPTY_COL ? parseCatalogNumber(row[cols.client]) : undefined;
    const genericPrice = cols.price !== EMPTY_COL ? parseCatalogNumber(row[cols.price]) : undefined;

    if (clientPrice === undefined && genericPrice !== undefined) clientPrice = genericPrice;
    if (platePrice === undefined && genericPrice !== undefined && type === "HARDWARE") {
      clientPrice = genericPrice;
    }

    if (
      platePrice === undefined &&
      clientPrice === undefined &&
      costPrice === undefined &&
      genericPrice === undefined
    ) {
      skipped++;
      continue;
    }

    if (sheetAreaSqm === undefined && heightM !== undefined && widthM !== undefined) {
      sheetAreaSqm = Math.round(heightM * widthM * 10000) / 10000;
    }

    const code = cols.code !== EMPTY_COL ? cellText(row[cols.code]) || undefined : undefined;
    let link = cols.link !== EMPTY_COL ? cellText(row[cols.link]) || undefined : undefined;

    if (!link) {
      for (const cell of row) {
        const text = cellText(cell);
        if (/^https?:\/\//i.test(text)) {
          link = text;
          break;
        }
      }
    }

    const unit = inferUnit(type, cols, row);

    items.push({
      sheetName,
      subcategory: currentSubcategory,
      name,
      code,
      type,
      unit,
      platePrice,
      heightM,
      widthM,
      sheetAreaSqm,
      costPrice,
      clientPrice,
      link,
      sourceRow: r + 1,
    });
  }

  if (items.length === 0 && rows.length > 1) {
    errors.push(`Лист «${sheetName}»: нет распознанных позиций (${rows.length} строк)`);
  }

  return { type, items, skipped, errors };
}

export function parseCatalogExcel(buffer: ArrayBuffer | Uint8Array | Buffer): CatalogParseResult {
  const data = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const workbook = XLSX.read(data, { type: "buffer", cellDates: false });

  const sheets: CatalogParseResult["sheets"] = [];
  let skipped = 0;
  const errors: string[] = [];

  workbook.SheetNames.forEach((sheetName, index) => {
    if (/^sheet\d+$/i.test(sheetName) && workbook.SheetNames.length > 1) {
      skipped++;
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const parsed = parseSheet(sheetName, sheet, index);
    skipped += parsed.skipped;
    errors.push(...parsed.errors);

    if (parsed.items.length > 0) {
      sheets.push({ name: sheetName, type: parsed.type, items: parsed.items });
    }
  });

  if (sheets.length === 0) {
    errors.push("Не удалось импортировать ни одного листа. Проверьте формат файла.");
  }

  return { sheets, skipped, errors };
}
