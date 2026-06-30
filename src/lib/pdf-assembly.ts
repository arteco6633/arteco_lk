import { extractModuleFromName } from "./module";
import type { LineCluster, ParsedPdfPart } from "./pdf-parts";
import { parseBazisPanelText, parseBazisTableRows } from "./pdf-bazis";
import { extractPdfPageLines, parsePartsFromLines } from "./pdf-parts";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import Tesseract from "tesseract.js";

export type AssemblyGuideEntry = {
  position: string;
  name: string;
  module?: string;
  dimensions?: string;
  quantity: number;
  edging?: string;
  material?: string;
};

export type AssemblyParseResult = {
  entries: AssemblyGuideEntry[];
  pageNumber: number;
  method: "text" | "ocr" | "none";
  errors: string[];
};

const RIGHT_TABLE_START_RATIO = 0.45;
const RENDER_SCALE = 3;
const PAGES_TO_TRY = [1, 2];

function toUint8Array(buffer: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  if (Buffer.isBuffer(buffer)) return Uint8Array.from(buffer);
  if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
  return new Uint8Array(buffer.slice(0));
}

function lineText(line: LineCluster): string {
  return line.items
    .sort((a, b) => a.x - b.x)
    .map((i) => i.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function filterTableSideLines(
  lines: LineCluster[],
  side: "left" | "right",
): LineCluster[] {
  const allX = lines.flatMap((l) => l.items.map((i) => i.x));
  if (allX.length === 0) return [];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const threshold = minX + (maxX - minX) * RIGHT_TABLE_START_RATIO;

  return lines
    .map((line) => ({
      y: line.y,
      items: line.items.filter((i) => (side === "right" ? i.x >= threshold : i.x < threshold)),
    }))
    .filter((line) => line.items.length > 0);
}

function extractPositionFromLine(line: string): string | null {
  const m = line.trim().match(/^(\d{1,3})\b/);
  return m ? m[1] : null;
}

function parsedPartToEntry(part: ParsedPdfPart, rawLine?: string): AssemblyGuideEntry | null {
  const fromLine = rawLine ? extractPositionFromLine(rawLine) : null;
  const fromCode = part.code && /^\d{1,3}$/.test(part.code.trim()) ? part.code.trim() : null;
  const fromSource =
    part.sourceLine != null && part.sourceLine > 0 && part.sourceLine < 500
      ? String(part.sourceLine)
      : null;

  const position = fromLine ?? fromCode ?? fromSource;
  if (!position || !part.name) return null;

  return {
    position,
    name: part.name,
    module: extractModuleFromName(part.name) ?? undefined,
    dimensions: part.dimensions,
    quantity: part.quantity,
    material: part.material,
  };
}

function mergeEntries(lists: AssemblyGuideEntry[][]): AssemblyGuideEntry[] {
  const map = new Map<string, AssemblyGuideEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const key = entry.module ? `${entry.module}:${entry.position}` : entry.position;
      if (!map.has(key)) map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => {
    const aNum = parseInt(a.position, 10);
    const bNum = parseInt(b.position, 10);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
    return a.position.localeCompare(b.position, "ru", { numeric: true });
  });
}

function parseAssemblyPanelLines(lines: LineCluster[]): AssemblyGuideEntry[] {
  const entries: AssemblyGuideEntry[] = [];
  const rows = lines.map((l) => ({ text: lineText(l), line: l }));

  for (const { text, line } of rows) {
    if (!text || /спецификация|поз\.?|наименование|длина|ширина/i.test(text)) continue;
    const pozMatch = text.match(/^(\d{1,3})\s+(.+)/);
    if (pozMatch) {
      const rest = pozMatch[2];
      const dimMatch = rest.match(/(\d{2,4})\s+(\d{2,4})/);
      const qtyMatch = rest.match(/\s(\d{1,2})\s+\d{2,4}\s+\d{2,4}/);
      let name = rest;
      if (qtyMatch && dimMatch) {
        name = rest.slice(0, qtyMatch.index).trim();
      } else if (dimMatch) {
        name = rest.slice(0, dimMatch.index).replace(/\s+\d{1,2}\s*$/, "").trim();
      }
      if (name.length >= 2) {
        entries.push({
          position: pozMatch[1],
          name,
          module: extractModuleFromName(name) ?? undefined,
          dimensions: dimMatch ? `${dimMatch[1]}×${dimMatch[2]}` : undefined,
          quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
        });
      }
      continue;
    }
  }

  if (entries.length > 0) return entries;

  const textResult = parsePartsFromLines(lines);
  for (let i = 0; i < lines.length; i++) {
    const part = textResult.parts.find((p) => p.sourceLine === i + 1);
    if (part) {
      const entry = parsedPartToEntry(part, lineText(lines[i]));
      if (entry) entries.push(entry);
    }
  }
  if (entries.length > 0) return entries;

  const bazis = parseBazisPanelText(rows.map((r) => r.text).join("\n"));
  return bazis.parts
    .map((p, i) => parsedPartToEntry(p, rows[i]?.text))
    .filter((e): e is AssemblyGuideEntry => e !== null);
}

async function ocrAssemblyTableRight(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  pageNumber: number,
): Promise<string[]> {
  const data = toUint8Array(buffer);
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const fullCanvas = createCanvas(viewport.width, viewport.height);
  const context = fullCanvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: fullCanvas as unknown as HTMLCanvasElement,
  }).promise;

  const cropStart = Math.floor(fullCanvas.width * RIGHT_TABLE_START_RATIO);
  const cropWidth = fullCanvas.width - cropStart;
  const cropped = createCanvas(cropWidth, fullCanvas.height);
  cropped.getContext("2d").drawImage(
    fullCanvas as never,
    cropStart,
    0,
    cropWidth,
    fullCanvas.height,
    0,
    0,
    cropWidth,
    fullCanvas.height,
  );

  const worker = await Tesseract.createWorker("rus+eng");
  const dataStartY = Math.floor(cropped.height * 0.22);
  const rowH = Math.max(26, Math.floor(cropped.height * 0.02));
  const rows: string[] = [];

  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });

  for (let i = 0; i < 45; i++) {
    const y = dataStartY + i * rowH;
    if (y + rowH > cropped.height) break;
    const strip = createCanvas(cropWidth, rowH + 2);
    strip
      .getContext("2d")
      .drawImage(cropped as never, 0, y, cropWidth, rowH + 2, 0, 0, cropWidth, rowH + 2);
    const { data: ocr } = await worker.recognize(strip.toBuffer("image/png"));
    const text = ocr.text.replace(/\s+/g, " ").trim();
    if (text) rows.push(text);
  }

  await worker.terminate();
  return rows;
}

async function parsePage(buffer: ArrayBuffer | Uint8Array | Buffer, pageNumber: number) {
  const collected: AssemblyGuideEntry[] = [];

  try {
    const lines = await extractPdfPageLines(buffer, pageNumber);
    if (lines.length > 0) {
      for (const subset of [
        filterTableSideLines(lines, "right"),
        lines,
        filterTableSideLines(lines, "left"),
      ]) {
        collected.push(...parseAssemblyPanelLines(subset));
      }
    }
  } catch {
    /* try ocr */
  }

  try {
    const ocrRows = await ocrAssemblyTableRight(buffer, pageNumber);
    const fromOcr = parseBazisTableRows(ocrRows).parts
      .map((p, i) => parsedPartToEntry(p, ocrRows[i]))
      .filter((e): e is AssemblyGuideEntry => e !== null);
    collected.push(...fromOcr);
    collected.push(
      ...parseAssemblyPanelLines(
        ocrRows.map((text, i) => ({ y: i, items: [{ text, x: 0 }] })),
      ),
    );
  } catch {
    /* ignore */
  }

  return mergeEntries([collected]);
}

export async function parseAssemblyGuideFromPdf(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): Promise<AssemblyParseResult> {
  const errors: string[] = [];
  let best: AssemblyGuideEntry[] = [];
  let bestPage = 1;
  let method: AssemblyParseResult["method"] = "none";

  const data = toUint8Array(buffer);
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = PAGES_TO_TRY.filter((p) => p <= pdf.numPages);

  for (const pageNumber of pages) {
    const entries = await parsePage(buffer, pageNumber);
    if (entries.length > best.length) {
      best = entries;
      bestPage = pageNumber;
      method = "text";
    }
  }

  if (best.length === 0) {
    errors.push(
      "Таблицу на чертеже не удалось распознать — используем спецификацию из системы (Excel).",
    );
  }

  return { entries: best, pageNumber: bestPage, method, errors };
}
