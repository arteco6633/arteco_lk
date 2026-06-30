import * as XLSX from "xlsx";

export type ImportedPartRow = {
  productNumber: string;
  productName?: string;
  specNumber?: number;
  name: string;
  code?: string;
  length?: string;
  width?: string;
  dimensions?: string;
  quantity: number;
  material?: string;
  sectionOrder?: number;
  edging?: string;
  groove?: string;
  rectangular?: string;
  sourceRow: number;
};

export type ImportedHardwareRow = {
  productNumber: string;
  productName?: string;
  specNumber?: number;
  code?: string;
  name: string;
  quantity: number;
  unit?: string;
  sourceRow: number;
};

export type SpecificationParseResult = {
  parts: ImportedPartRow[];
  hardware: ImportedHardwareRow[];
  skipped: number;
  errors: string[];
};

export type ParseResult<T> = {
  rows: T[];
  skipped: number;
  errors: string[];
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/№/g, "номер ")
    .replace(/#/g, "номер ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    if (Math.abs(value - Math.round(value)) < 0.0001) return String(Math.round(value));
    return String(value);
  }
  return String(value).trim();
}

export function normalizeProductNumber(value: string): string {
  const trimmed = value.trim();
  if (/^\d+\.0+$/.test(trimmed)) return trimmed.split(".")[0];
  return trimmed;
}

function columnScore(header: string, matchers: string[]): number {
  const h = normalizeHeader(header);
  if (!h) return -1;

  let best = -1;
  for (const matcher of matchers) {
    const m = normalizeHeader(matcher);
    if (!m) continue;
    if (h === m) best = Math.max(best, 100);
    else if (h.startsWith(m) || m.startsWith(h)) best = Math.max(best, 80);
    else if (h.includes(m) || m.includes(h)) best = Math.max(best, 60);
  }
  return best;
}

function pickColumnIndex(headers: string[], matchers: string[]): number {
  let bestIndex = -1;
  let bestScore = -1;

  headers.forEach((header, index) => {
    const score = columnScore(header, matchers);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 60 ? bestIndex : -1;
}

function getCell(values: unknown[], index: number): string {
  if (index < 0) return "";
  return formatCell(values[index]);
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const headers = (rows[i] as unknown[]).map((h) => String(h ?? ""));
    const productCol = pickColumnIndex(headers, [
      "номер изделия",
      "№ изделия",
      "изделие",
      "product",
    ]);
    const nameCol = pickColumnIndex(headers, [
      "название детали",
      "название",
      "деталь",
      "наименование",
      "фурнитура",
      "name",
    ]);
    if (productCol >= 0 && nameCol >= 0 && productCol !== nameCol) return i;
  }
  return 0;
}

function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "array" });
}

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
}

function readSheetRows(buffer: ArrayBuffer): unknown[][] {
  const workbook = readWorkbook(buffer);
  return sheetToRows(workbook, workbook.SheetNames[0]);
}

function rowCells(row: unknown[] | undefined): string[] {
  if (!row) return [];
  return row.map((c) => formatCell(c));
}

function rowIsEmpty(cells: string[]): boolean {
  return cells.every((c) => !c.trim());
}

function combinedHeaders(main: string[], sub?: string[]): string[] {
  const len = Math.max(main.length, sub?.length ?? 0);
  return Array.from({ length: len }, (_, i) =>
    normalizeHeader(`${main[i] ?? ""} ${sub?.[i] ?? ""}`),
  );
}

function findCol(headers: string[], matchers: string[]): number {
  return pickColumnIndex(headers, matchers);
}

function parseQuantity(raw: string): number {
  if (!raw) return 1;
  const n = Math.round(Number(raw.replace(",", ".").replace(/\s/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatDimensions(length: string, width: string): string | undefined {
  const l = length.replace(",", ".").trim();
  const w = width.replace(",", ".").trim();
  if (l && w) return `${l}x${w}`;
  if (l || w) return l || w;
  return undefined;
}

function extractProductReference(article: string, productName: string): {
  productNumber: string;
  productName?: string;
} {
  const articleTrim = article.trim();
  if (articleTrim) {
    return { productNumber: normalizeProductNumber(articleTrim), productName: productName || undefined };
  }
  const leading = productName.match(/^(\d+)/);
  if (leading) {
    return { productNumber: normalizeProductNumber(leading[1]), productName: productName || undefined };
  }
  return { productNumber: "1", productName: productName || undefined };
}

function isPartsHeader(cells: string[]): boolean {
  const h = cells.map((c) => normalizeHeader(c));
  const hasName = h.some((x) => x.includes("наименование"));
  const hasPos = h.some((x) => x === "поз" || x.startsWith("поз"));
  const hasSize = h.some((x) => x.includes("длина") || x.includes("ширина") || x.includes("готовая"));
  return hasName && (hasPos || hasSize);
}

function isHardwareHeader(cells: string[]): boolean {
  const h = cells.map((c) => normalizeHeader(c));
  return (
    h.some((x) => x.includes("артикул")) &&
    h.some((x) => x.includes("наименование")) &&
    h.some((x) => x.includes("кол"))
  );
}

function isSubHeaderLengthWidth(cells: string[]): boolean {
  const h = cells.map((c) => normalizeHeader(c));
  return (
    h.some((x) => x === "длина" || x.endsWith("длина")) &&
    h.some((x) => x === "ширина" || x.endsWith("ширина"))
  );
}

function parseSpecNumber(raw: string): number | undefined {
  const value = formatCell(raw).trim();
  if (!value) return undefined;
  const normalized = value.replace(",", ".");
  if (/^\d+$/.test(normalized)) return parseInt(normalized, 10);
  const asNumber = Number(normalized);
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.round(asNumber);
  return undefined;
}

function findNumColRaw(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const raw = String(headers[i] ?? "").trim();
    if (!raw) continue;
    const norm = normalizeHeader(raw);
    if (norm === "номер" || raw === "№" || raw === "#") return i;
  }
  return -1;
}

function readSpecNumber(cells: string[], numCol: number): number | undefined {
  if (numCol < 0) return undefined;
  return parseSpecNumber(getCell(cells, numCol));
}

function mapPartsColumns(main: string[], sub?: string[]) {
  const headers = combinedHeaders(main, sub);
  const lengthCol = headers.findIndex(
    (h) => h === "длина" || h.endsWith(" длина") || h.includes("длина"),
  );
  const widthCol = headers.findIndex(
    (h) => h === "ширина" || h.endsWith(" ширина") || h.includes("ширина"),
  );
  const sizeCol = headers.findIndex((h) => h.includes("размер") || h.includes("габарит"));
  const edgingCol = headers.findIndex((h) => h.includes("облицовка"));
  const grooveCol = headers.findIndex((h) => h === "паз" || h.startsWith("паз"));
  const rectangularCol = headers.findIndex((h) => h.includes("прямоуг"));
  return {
    numCol: findNumColRaw(main),
    posCol: findCol(headers, ["поз", "поз.", "позиция"]),
    nameCol: findCol(headers, ["наименование", "деталь", "название"]),
    lengthCol,
    widthCol,
    sizeCol,
    qtyCol: findCol(headers, ["кол-во", "количество", "кол"]),
    edgingCol,
    grooveCol,
    rectangularCol,
  };
}

function mapHardwareColumns(main: string[]) {
  const headers = main.map((c) => normalizeHeader(c));
  return {
    numCol: findNumColRaw(main),
    articleCol: findCol(headers, ["артикул", "article"]),
    nameCol: findCol(headers, ["наименование", "название", "name"]),
    qtyCol: findCol(headers, ["кол-во", "количество", "кол"]),
    unitCol: findCol(headers, ["ед", "единица", "ед. изм"]),
  };
}

function readLabelValue(cells: string[]): { label: string; value: string } | null {
  for (let i = 0; i < cells.length; i++) {
    const norm = normalizeHeader(cells[i]);
    if (!norm) continue;
    if (norm === "заказ" || norm === "изделие" || norm === "артикул изделия") {
      const value = cells.slice(i + 1).find((c) => c.trim()) ?? "";
      return { label: norm, value };
    }
  }
  return null;
}

function isDataSeparatorRow(cells: string[]): boolean {
  const text = cells.join(" ").toLowerCase();
  return (
    text.includes("спецификация на") ||
    text.includes("заказ") ||
    text.includes("изделие") ||
    text.includes("артикул изделия")
  );
}

function isCommentRow(cells: string[]): boolean {
  const joined = cells.join(" ").trim();
  if (!joined) return false;
  if (/^\d+\s*-\s*[\d.,/]+/.test(joined) && !cells.some((c) => /M\d+_/i.test(c))) return true;
  if (/для всего/i.test(joined)) return true;
  return false;
}

function looksLikePartsDataRow(
  cells: string[],
  cols: ReturnType<typeof mapPartsColumns>,
): boolean {
  const index = getCell(cells, 0);
  const pos = getCell(cells, cols.posCol);
  const name = getCell(cells, cols.nameCol);
  const length = getCell(cells, cols.lengthCol);
  const width = getCell(cells, cols.widthCol);

  if (name && normalizeHeader(name) !== "наименование") return true;
  if (pos) return true;
  if (/^\d+$/.test(index) && (length || width)) return true;
  return false;
}

function looksLikeHardwareDataRow(
  cells: string[],
  cols: ReturnType<typeof mapHardwareColumns>,
): boolean {
  const index = getCell(cells, 0);
  const article = getCell(cells, cols.articleCol);
  const name = getCell(cells, cols.nameCol);
  if (article || name) return true;
  return /^\d+$/.test(index);
}

function mergeParseResults(
  a: SpecificationParseResult,
  b: SpecificationParseResult,
): SpecificationParseResult {
  return {
    parts: [...a.parts, ...b.parts],
    hardware: [...a.hardware, ...b.hardware],
    skipped: a.skipped + b.skipped,
    errors: [...a.errors, ...b.errors],
  };
}

function extractSectionTitle(cells: string[]): string {
  const text = cells.join(" ").replace(/\s+/g, " ").trim();
  const match = text.match(/спецификация на\s*(.+)/i);
  return match?.[1]?.trim() ?? text;
}

function rowLabel(sheetName: string | undefined, rowIndex: number): string {
  const prefix = sheetName ? `Лист «${sheetName}», ` : "";
  return `${prefix}строка ${rowIndex + 1}`;
}

/** Парсер спецификации Базис: несколько материалов + фурнитура на одном листе */
export function parseBazisFromRows(
  rows: unknown[][],
  sheetName?: string,
): SpecificationParseResult {
  const parts: ImportedPartRow[] = [];
  const hardware: ImportedHardwareRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  let currentMaterial = "";
  let currentProductName = "";
  let currentProductArticle = "";
  let mode: "parts" | "hardware" | null = null;
  let partsCols: ReturnType<typeof mapPartsColumns> | null = null;
  let hwCols: ReturnType<typeof mapHardwareColumns> | null = null;

  for (let i = 0; i < rows.length; i++) {
    const cells = rowCells(rows[i] as unknown[]);
    if (rowIsEmpty(cells)) continue;

    const joined = cells.join(" ");

    if (/спецификация на/i.test(joined)) {
      partsCols = null;
      hwCols = null;
      if (/фурнитур/i.test(joined)) {
        mode = "hardware";
        currentMaterial = "";
      } else {
        mode = "parts";
        currentMaterial = extractSectionTitle(cells);
      }
      continue;
    }

    if (isHardwareHeader(cells)) {
      mode = "hardware";
      hwCols = mapHardwareColumns(cells);
      partsCols = null;
      continue;
    }

    if (isPartsHeader(cells)) {
      mode = "parts";
      const next = rowCells(rows[i + 1] as unknown[]);
      if (isSubHeaderLengthWidth(next)) {
        partsCols = mapPartsColumns(cells, next);
        i++;
      } else {
        partsCols = mapPartsColumns(cells);
      }
      hwCols = null;
      continue;
    }

    const label = readLabelValue(cells);
    if (label) {
      if (label.label.startsWith("изделие")) currentProductName = label.value;
      if (label.label === "артикул изделия") currentProductArticle = label.value;
      continue;
    }

    if (isCommentRow(cells)) continue;

    const productRef = extractProductReference(currentProductArticle, currentProductName);

    if (mode === "hardware" && hwCols) {
      const article = getCell(cells, hwCols.articleCol);
      const name = getCell(cells, hwCols.nameCol);
      if (!name && !article) {
        if (looksLikeHardwareDataRow(cells, hwCols)) {
          skipped++;
          errors.push(`${rowLabel(sheetName, i)}: пропущена фурнитура без артикула и наименования`);
        }
        continue;
      }
      if (normalizeHeader(name) === "наименование" || normalizeHeader(article) === "артикул") {
        continue;
      }

      hardware.push({
        productNumber: productRef.productNumber,
        productName: productRef.productName,
        specNumber: readSpecNumber(cells, hwCols.numCol),
        code: article || undefined,
        name: name || article,
        quantity: parseQuantity(getCell(cells, hwCols.qtyCol)),
        unit: getCell(cells, hwCols.unitCol) || undefined,
        sourceRow: i + 1,
      });
      continue;
    }

    if (mode === "parts" && partsCols && partsCols.nameCol >= 0) {
      if (isDataSeparatorRow(cells)) continue;

      const name = getCell(cells, partsCols.nameCol);
      if (!name || normalizeHeader(name) === "наименование") {
        if (looksLikePartsDataRow(cells, partsCols)) {
          skipped++;
          errors.push(`${rowLabel(sheetName, i)}: пропущена деталь без наименования`);
        }
        continue;
      }

      const length = getCell(cells, partsCols.lengthCol);
      const width = getCell(cells, partsCols.widthCol);
      const sizeFallback = getCell(cells, partsCols.sizeCol);
      const dimensions =
        formatDimensions(length, width) ??
        (sizeFallback ? sizeFallback.replace(/×/g, "x") : undefined);

      const code = getCell(cells, partsCols.posCol) || undefined;
      const edging = getCell(cells, partsCols.edgingCol) || undefined;
      const groove = getCell(cells, partsCols.grooveCol) || undefined;
      const rectangular = getCell(cells, partsCols.rectangularCol) || undefined;

      parts.push({
        productNumber: productRef.productNumber,
        productName: productRef.productName,
        specNumber: readSpecNumber(cells, partsCols.numCol),
        name,
        code,
        length: length || undefined,
        width: width || undefined,
        dimensions,
        quantity: parseQuantity(getCell(cells, partsCols.qtyCol)),
        material: currentMaterial || undefined,
        edging,
        groove,
        rectangular,
        sourceRow: i + 1,
      });
    }
  }

  return { parts, hardware, skipped, errors };
}

export function parseBazisSpecification(buffer: ArrayBuffer): SpecificationParseResult {
  return parseBazisFromRows(readSheetRows(buffer));
}

export function parseSpecificationExcel(buffer: ArrayBuffer): SpecificationParseResult {
  const workbook = readWorkbook(buffer);

  let result: SpecificationParseResult = { parts: [], hardware: [], skipped: 0, errors: [] };
  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook, sheetName);
    result = mergeParseResults(result, parseBazisFromRows(rows, sheetName));
  }

  if (result.parts.length > 0 || result.hardware.length > 0) return result;

  const parts = parseSimplePartsExcel(buffer);
  const hardware = parseSimpleHardwareExcel(buffer);
  return {
    parts: parts.rows,
    hardware: hardware.rows,
    skipped: parts.skipped + hardware.skipped,
    errors: [...parts.errors, ...hardware.errors],
  };
}

function parseSimplePartsExcel(buffer: ArrayBuffer): ParseResult<ImportedPartRow> {
  const rows = readSheetRows(buffer);
  const errors: string[] = [];
  let skipped = 0;

  if (rows.length < 2) {
    return { rows: [], skipped: 0, errors: ["Файл пуст или содержит только заголовок"] };
  }

  const headerIndex = findHeaderRowIndex(rows as unknown[][]);
  const rawHeaders = (rows[headerIndex] as unknown[]).map((h) => String(h ?? ""));

  const productCol = pickColumnIndex(rawHeaders, [
    "номер изделия",
    "№ изделия",
    "изделие",
    "product",
    "product number",
  ]);
  const nameCol = pickColumnIndex(rawHeaders, [
    "название детали",
    "название",
    "деталь",
    "наименование",
    "наименование детали",
    "name",
    "part",
  ]);
  const codeCol = pickColumnIndex(rawHeaders, ["код детали", "код", "артикул", "code"]);
  const sizeCol = pickColumnIndex(rawHeaders, ["размер", "габариты", "размеры", "dimensions"]);
  const qtyCol = pickColumnIndex(rawHeaders, ["количество", "кол-во", "кол", "qty", "quantity"]);
  const materialCol = pickColumnIndex(rawHeaders, ["материал", "material"]);

  if (productCol < 0 || nameCol < 0) {
    return {
      rows: [],
      skipped: 0,
      errors: [
        "Не найдены колонки «№ изделия» и «Название детали». Проверьте шаблон Excel.",
      ],
    };
  }

  const parts: ImportedPartRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const values = rows[i] as unknown[];
    if (!values || values.every((v) => formatCell(v) === "")) continue;

    const productNumber = normalizeProductNumber(getCell(values, productCol));
    const name = getCell(values, nameCol);

    if (!productNumber || !name) {
      skipped++;
      errors.push(`Строка ${i + 1}: не указан № изделия или название детали`);
      continue;
    }

    const rawQty = getCell(values, qtyCol);
    const quantity = rawQty ? Math.max(1, Math.round(Number(rawQty.replace(",", ".")))) : 1;

    parts.push({
      productNumber,
      name,
      code: getCell(values, codeCol) || undefined,
      dimensions: getCell(values, sizeCol) || undefined,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      material: getCell(values, materialCol) || undefined,
      sourceRow: i + 1,
    });
  }

  return { rows: parts, skipped, errors };
}

export function parsePartsExcel(buffer: ArrayBuffer): ParseResult<ImportedPartRow> {
  const spec = parseSpecificationExcel(buffer);
  if (spec.parts.length > 0) {
    return { rows: spec.parts, skipped: spec.skipped, errors: spec.errors };
  }
  return parseSimplePartsExcel(buffer);
}

function parseSimpleHardwareExcel(buffer: ArrayBuffer): ParseResult<ImportedHardwareRow> {
  const rows = readSheetRows(buffer);
  const errors: string[] = [];
  let skipped = 0;

  if (rows.length < 2) {
    return { rows: [], skipped: 0, errors: ["Файл пуст или содержит только заголовок"] };
  }

  const headerIndex = findHeaderRowIndex(rows as unknown[][]);
  const rawHeaders = (rows[headerIndex] as unknown[]).map((h) => String(h ?? ""));

  const productCol = pickColumnIndex(rawHeaders, ["номер изделия", "№ изделия", "изделие"]);
  const nameCol = pickColumnIndex(rawHeaders, [
    "название",
    "фурнитура",
    "наименование",
    "наименование фурнитуры",
    "name",
  ]);
  const codeCol = pickColumnIndex(rawHeaders, ["артикул", "код", "code"]);
  const qtyCol = pickColumnIndex(rawHeaders, ["количество", "кол-во", "кол", "qty"]);
  const unitCol = pickColumnIndex(rawHeaders, ["ед", "единица", "ед. изм", "unit"]);

  if (productCol < 0 || nameCol < 0) {
    return {
      rows: [],
      skipped: 0,
      errors: ["Не найдены колонки «№ изделия» и «Название». Проверьте шаблон Excel."],
    };
  }

  const items: ImportedHardwareRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const values = rows[i] as unknown[];
    if (!values || values.every((v) => formatCell(v) === "")) continue;

    const productNumber = normalizeProductNumber(getCell(values, productCol));
    const name = getCell(values, nameCol);
    const code = getCell(values, codeCol) || undefined;

    if (!productNumber || !name) {
      skipped++;
      errors.push(`Строка ${i + 1}: не указан № изделия или название фурнитуры`);
      continue;
    }

    const rawQty = getCell(values, qtyCol);
    const quantity = rawQty ? Math.max(1, Math.round(Number(rawQty.replace(",", ".")))) : 1;

    items.push({
      productNumber,
      code,
      name,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit: getCell(values, unitCol) || undefined,
      sourceRow: i + 1,
    });
  }

  return { rows: items, skipped, errors };
}

export function parseHardwareExcel(buffer: ArrayBuffer): ParseResult<ImportedHardwareRow> {
  const spec = parseSpecificationExcel(buffer);
  if (spec.hardware.length > 0) {
    return { rows: spec.hardware, skipped: spec.skipped, errors: spec.errors };
  }
  return parseSimpleHardwareExcel(buffer);
}
