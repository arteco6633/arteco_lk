import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parsePartsFromBazisPdf } from "./pdf-bazis";

export type ParsedPdfPart = {
  name: string;
  code?: string;
  dimensions?: string;
  quantity: number;
  material?: string;
  sourceLine?: number;
};

export type PdfParseResult = {
  parts: ParsedPdfPart[];
  pageNumber: number;
  rawLineCount: number;
  errors: string[];
  previewLines: string[];
};

export type LineCluster = {
  y: number;
  items: Array<{ text: string; x: number }>;
};

type ColumnMap = {
  name: number;
  code: number;
  dimensions: number;
  quantity: number;
  material: number;
};

const Y_TOLERANCE = 6;
const PAGE_NUMBER = 2;

const HEADER_HINTS: Record<keyof ColumnMap, string[]> = {
  name: ["наименование", "название", "деталь", "позиция", "name", "part"],
  code: ["код", "артикул", "code", "арт"],
  dimensions: ["размер", "габарит", "габариты", "dimensions"],
  quantity: ["кол-во", "количество", "кол.", "кол ", "qty", "quantity"],
  material: ["материал", "material", "мат"],
};

const SKIP_LINE = /^(итого|всего|страница|page|\d{1,2}\s*\/\s*\d{1,2})$/i;
const DIMENSION_RE = /\d+\s*[xх×]\s*\d+(?:\s*[xх×]\s*\d+)?/;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function lineText(line: LineCluster): string {
  return line.items
    .sort((a, b) => a.x - b.x)
    .map((i) => i.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function clusterLines(items: TextItem[]): LineCluster[] {
  const mapped = items
    .filter((item): item is TextItem & { str: string } => "str" in item && Boolean(item.str?.trim()))
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
    }));

  const sorted = [...mapped].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: LineCluster[] = [];

  for (const item of sorted) {
    const existing = lines.find((l) => Math.abs(l.y - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.items.push({ text: item.text, x: item.x });
    } else {
      lines.push({ y: item.y, items: [{ text: item.text, x: item.x }] });
    }
  }

  return lines;
}

function detectHeaderIndex(lines: LineCluster[]): number {
  let bestIndex = -1;
  let bestScore = 0;

  lines.forEach((line, index) => {
    const text = normalize(lineText(line));
    let score = 0;
    if (HEADER_HINTS.name.some((h) => text.includes(h))) score += 3;
    if (HEADER_HINTS.dimensions.some((h) => text.includes(h))) score += 2;
    if (HEADER_HINTS.quantity.some((h) => text.includes(h))) score += 2;
    if (HEADER_HINTS.material.some((h) => text.includes(h))) score += 1;
    if (HEADER_HINTS.code.some((h) => text.includes(h))) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 3 ? bestIndex : -1;
}

function columnPositions(line: LineCluster): ColumnMap {
  const positions: Partial<Record<keyof ColumnMap, number>> = {};
  const sorted = [...line.items].sort((a, b) => a.x - b.x);

  for (const item of sorted) {
    const text = normalize(item.text);
    for (const key of Object.keys(HEADER_HINTS) as (keyof ColumnMap)[]) {
      if (positions[key] !== undefined) continue;
      if (HEADER_HINTS[key].some((hint) => text.includes(hint))) {
        positions[key] = item.x;
      }
    }
  }

  const fallback = sorted.map((i) => i.x);
  return {
    name: positions.name ?? fallback[0] ?? 0,
    code: positions.code ?? fallback[1] ?? fallback[0] ?? 0,
    dimensions: positions.dimensions ?? fallback[2] ?? fallback[1] ?? 0,
    quantity: positions.quantity ?? fallback[fallback.length - 2] ?? fallback[fallback.length - 1] ?? 0,
    material: positions.material ?? fallback[fallback.length - 1] ?? 0,
  };
}

function pickByColumn(line: LineCluster, columnX: number, nextColumnX?: number): string {
  const sorted = [...line.items].sort((a, b) => a.x - b.x);
  const mid = nextColumnX !== undefined ? (columnX + nextColumnX) / 2 : columnX - 20;

  const parts = sorted.filter((item) => {
    if (nextColumnX !== undefined) {
      return item.x >= mid && item.x < (columnX + nextColumnX) / 2 + (nextColumnX - columnX) / 2;
    }
    return item.x >= columnX - 15;
  });

  // Simpler: take items whose x is closest to column anchor within half-distance to next col
  const candidates = sorted.filter((item) => item.x >= columnX - 25);
  if (nextColumnX !== undefined) {
    return candidates
      .filter((item) => item.x < nextColumnX - 10)
      .map((i) => i.text)
      .join(" ")
      .trim();
  }
  return candidates.map((i) => i.text).join(" ").trim();
}

function parseQuantity(value: string): number {
  const match = value.match(/\d+/);
  if (!match) return 1;
  const num = Number(match[0]);
  return Number.isFinite(num) && num > 0 ? num : 1;
}

function parseRowWithColumns(line: LineCluster, columns: ColumnMap): ParsedPdfPart | null {
  const xs = [
    columns.name,
    columns.code,
    columns.dimensions,
    columns.quantity,
    columns.material,
  ].sort((a, b) => a - b);

  const name = pickByColumn(line, columns.name, columns.code > columns.name ? columns.code : columns.dimensions);
  const code = pickByColumn(line, columns.code, columns.dimensions);
  const dimensionsRaw = pickByColumn(line, columns.dimensions, columns.quantity);
  const qtyRaw = pickByColumn(line, columns.quantity, columns.material);
  const material = pickByColumn(line, columns.material);

  const fullLine = lineText(line);
  if (!name || name.length < 2) return null;
  if (SKIP_LINE.test(normalize(name)) || SKIP_LINE.test(normalize(fullLine))) return null;

  const dimensions =
    dimensionsRaw.match(DIMENSION_RE)?.[0]?.replace(/\s+/g, "") ??
    (dimensionsRaw || undefined);
  const quantity = parseQuantity(qtyRaw || fullLine);

  // Skip if line looks like header
  const nameNorm = normalize(name);
  if (HEADER_HINTS.name.some((h) => nameNorm === h || nameNorm.startsWith(h + " "))) return null;

  return {
    name: name.replace(DIMENSION_RE, "").trim() || name,
    code: code && code !== name ? code : undefined,
    dimensions: dimensions || fullLine.match(DIMENSION_RE)?.[0]?.replace(/\s+/g, ""),
    quantity,
    material: material && material !== qtyRaw ? material : undefined,
  };
}

function parseRowHeuristic(line: LineCluster, lineIndex: number): ParsedPdfPart | null {
  const full = lineText(line);
  if (!full || full.length < 3) return null;
  if (SKIP_LINE.test(normalize(full))) return null;

  const dimMatch = full.match(DIMENSION_RE);
  if (!dimMatch && !/[а-яёa-z]/i.test(full)) return null;

  const tokens = full.split(/\s{2,}|\t+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 1 && !dimMatch) return null;

  let name = full;
  let dimensions = dimMatch?.[0].replace(/\s+/g, "");
  let quantity = 1;
  let material: string | undefined;
  let code: string | undefined;

  const qtyMatch = full.match(/(?:^|\s)(\d{1,3})(?:\s*$)/);
  if (qtyMatch) {
    quantity = parseQuantity(qtyMatch[1]);
    name = full.slice(0, qtyMatch.index).trim();
  }

  if (tokens.length >= 2) {
    name = tokens[0];
    for (const token of tokens.slice(1)) {
      if (DIMENSION_RE.test(token)) dimensions = token.replace(/\s+/g, "");
      else if (/^\d+$/.test(token)) quantity = parseQuantity(token);
      else if (/^(лдсп|мдф|дсп|хдф|фанера)/i.test(token)) material = token;
      else if (/^[a-zа-яё0-9][\wа-яё.-]{1,10}$/i.test(token) && !code) code = token;
      else if (!material && token.length <= 20) material = token;
    }
  }

  if (dimMatch) {
    name = name.replace(DIMENSION_RE, "").replace(/\s+/g, " ").trim();
  }

  if (!name || name.length < 2) return null;
  if (HEADER_HINTS.name.some((h) => normalize(name) === h)) return null;

  return { name, code, dimensions, quantity, material, sourceLine: lineIndex + 1 };
}

export function parsePartsFromLines(lines: LineCluster[]): PdfParseResult {
  const errors: string[] = [];
  const previewLines = lines.map((l) => lineText(l)).filter(Boolean);
  const headerIndex = detectHeaderIndex(lines);
  const parts: ParsedPdfPart[] = [];

  if (headerIndex >= 0) {
    const columns = columnPositions(lines[headerIndex]);
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const parsed = parseRowWithColumns(lines[i], columns);
      if (parsed?.name) {
        parts.push({ ...parsed, sourceLine: i + 1 });
      }
    }
  }

  if (parts.length === 0) {
    lines.forEach((line, index) => {
      if (headerIndex >= 0 && index <= headerIndex) return;
      const parsed = parseRowHeuristic(line, index);
      if (parsed) parts.push(parsed);
    });
  }

  if (parts.length === 0) {
    errors.push(
      "Не удалось распознать детали на 2-й странице. Проверьте, что там есть таблица с названиями и размерами.",
    );
  }

  return {
    parts,
    pageNumber: PAGE_NUMBER,
    rawLineCount: lines.length,
    errors,
    previewLines: previewLines.slice(0, 15),
  };
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  if (Buffer.isBuffer(buffer)) return Uint8Array.from(buffer);
  if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
  // pdfjs может «отсоединить» ArrayBuffer — всегда копируем
  return new Uint8Array(buffer.slice(0));
}

export async function extractPdfPageLines(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  pageNumber = PAGE_NUMBER,
): Promise<LineCluster[]> {
  const data = toUint8Array(buffer);
  const pdf = await getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  if (pageNumber > pdf.numPages) {
    throw new Error(`В PDF только ${pdf.numPages} стр., а нужна страница ${pageNumber}`);
  }

  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  return clusterLines(content.items as TextItem[]);
}

export async function parsePartsFromPdfPage2(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): Promise<PdfParseResult & { method?: "text" | "ocr" }> {
  const data = toUint8Array(buffer);
  const lines = await extractPdfPageLines(data, PAGE_NUMBER);

  if (lines.length > 0) {
    const textResult = parsePartsFromLines(lines);
    if (textResult.parts.length > 0) {
      return { ...textResult, method: "text" };
    }
  }

  // PDF без текстового слоя (часто у технолога) — OCR 2-й страницы
  return parsePartsFromBazisPdf(data);
}
