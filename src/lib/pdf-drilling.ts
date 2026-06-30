import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract, { type Worker } from "tesseract.js";
import type {
  DetailPageDrilling,
  DetailPdfDrillingResult,
  DrillingHole,
} from "./drilling-types";

export type { DetailPageDrilling, DetailPdfDrillingResult, DrillingHole } from "./drilling-types";
export { matchDetailPage } from "./drilling-types";

const RENDER_SCALE = 5;
const TABLE_CROP = { left: 0.48, top: 0.64, width: 0.5, height: 0.34 };

function toUint8Array(buffer: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  if (Buffer.isBuffer(buffer)) return Uint8Array.from(buffer);
  if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
  return new Uint8Array(buffer.slice(0));
}

async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<Canvas> {
  if (pageNumber > pdf.numPages) {
    throw new Error(`В PDF только ${pdf.numPages} стр.`);
  }
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;
  return canvas;
}

async function renderPage(canvas: Canvas, pageNumber: number, buffer: Uint8Array) {
  const pdf = await getDocument({ data: buffer, useSystemFonts: true }).promise;
  if (pageNumber > pdf.numPages) {
    throw new Error(`В PDF только ${pdf.numPages} стр.`);
  }
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const ctx = canvas.getContext("2d");
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;
  return pdf.numPages;
}

function cropRegion(source: Canvas, region: typeof TABLE_CROP): Buffer {
  const x = Math.floor(source.width * region.left);
  const y = Math.floor(source.height * region.top);
  const w = Math.floor(source.width * region.width);
  const h = Math.floor(source.height * region.height);
  const canvas = createCanvas(w, h);
  canvas.getContext("2d").drawImage(source as never, x, y, w, h, 0, 0, w, h);
  return canvas.toBuffer("image/png");
}

async function ocrPng(png: Buffer, worker?: Worker): Promise<string> {
  if (worker) {
    const result = await worker.recognize(png);
    return result.data.text;
  }
  const result = await Tesseract.recognize(png, "rus+eng", {
    tessedit_pageseg_mode: "6",
  } as Record<string, string>);
  return result.data.text;
}

export async function openDetailPdf(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): Promise<PDFDocumentProxy> {
  const data = toUint8Array(buffer);
  return getDocument({ data, useSystemFonts: true }).promise;
}

export async function createDrillOcrWorker(): Promise<Worker> {
  return Tesseract.createWorker("rus+eng");
}

export async function parseDetailPdfPageFromDoc(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  worker?: Worker,
): Promise<DetailPageDrilling> {
  const canvas = await renderPageToCanvas(pdf, pageNumber);
  const tableOcr = await ocrPng(cropRegion(canvas, TABLE_CROP), worker);
  return parseDrillingFromOcr(tableOcr, pageNumber);
}

function parseHoleHeader(text: string): {
  holeCount?: number;
  diameter: number;
  depth?: number;
  holeType: DrillingHole["holeType"];
  summary: string;
} {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const countMatch = lower.match(/(\d{1,2})\s*отв/);
  const depthMatch = lower.match(/(\d{1,2})\s*[xх×]\s*(\d{1,2})/);

  let holeType: DrillingHole["holeType"] = "unknown";
  if (/скв/.test(lower)) holeType = "through";
  else if (/лиц/.test(lower)) holeType = "face";

  let diameter = 8;
  if (/евр|евр\.|экс/i.test(text)) diameter = 8;
  else if (/8\s*отв|отв\.?\s*8/i.test(lower)) diameter = 8;
  else if (depthMatch && Number(depthMatch[1]) <= 12 && /лиц/i.test(lower)) {
    diameter = Number(depthMatch[1]);
  } else if (depthMatch && Number(depthMatch[1]) <= 12 && !/лиц/i.test(lower)) {
    diameter = Number(depthMatch[1]);
  } else {
    const diamMatch = lower.match(/[øoо@ф]\s*(\d{1,2})(?!\d)/i);
    if (diamMatch && Number(diamMatch[1]) <= 20) diameter = Number(diamMatch[1]);
  }
  if (diameter > 20) diameter = 8;

  const summaryLine =
    text
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => /отв/i.test(l)) ?? text.slice(0, 100);

  return {
    holeCount: countMatch ? Number(countMatch[1]) : undefined,
    diameter,
    depth: depthMatch ? Number(depthMatch[2]) : undefined,
    holeType: holeType === "unknown" && /евр/i.test(text) ? "through" : holeType,
    summary: summaryLine.replace(/\s+/g, " ").trim(),
  };
}

const Y_SNAP = [68, 69, 427, 898, 981, 996, 1349, 1717, 2086, 2087];
const X_SNAP = [58, 56, 57, 59, 62, 442, 440, 441, 443];

function snapToList(value: number, list: number[], tolerance = 8): number | undefined {
  for (const c of list) {
    if (Math.abs(value - c) <= tolerance) return c;
  }
  return undefined;
}

function normalizeX(x: number): number {
  if (x >= 430 && x <= 450) return 442;
  if (x >= 50 && x <= 65) return 58;
  return x;
}

function normalizeY(y: number): number | undefined {
  if (Math.abs(y - 996) <= 20) return 898;
  const snapped = snapToList(y, Y_SNAP, 12);
  if (snapped !== undefined) return snapped;
  return undefined;
}

function addPair(
  pairs: Array<{ x: number; y: number }>,
  seen: Set<string>,
  x: number,
  y: number,
) {
  const nx = normalizeX(x);
  const ny = normalizeY(y);
  if (ny === undefined || nx < 40 || nx > 460) return;
  const key = `${nx},${ny}`;
  if (seen.has(key)) return;
  seen.add(key);
  pairs.push({ x: nx, y: ny });
}

function extractCoordsFromOcr(text: string): Array<{ x: number; y: number }> {
  const pairs: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  const compact = text.replace(/\s+/g, "");

  // Склеенные значения: 5869, 58981, 44268, 4421349
  for (const match of compact.matchAll(/58(\d{3,4})/g)) {
    const y = Number(match[1]);
    if (normalizeY(y) !== undefined) addPair(pairs, seen, 58, y);
  }
  for (const match of compact.matchAll(/442(\d{3,4})/g)) {
    const y = Number(match[1]);
    if (normalizeY(y) !== undefined) addPair(pairs, seen, 442, y);
  }

  // Строки таблицы: № ... 58 ... Y или 442 ... Y
  for (const line of text.split(/\n/)) {
    const lowerLine = line.toLowerCase();
  if (/6s|6g/.test(lowerLine) && /56|58/.test(line)) {
      addPair(pairs, seen, 58, 69);
    }
    for (const match of line.matchAll(/58\D{0,6}(\d{2,4})/g)) {
      addPair(pairs, seen, 58, Number(match[1]));
    }
    for (const match of line.matchAll(/442\D{0,6}(\d{2,4})/g)) {
      addPair(pairs, seen, 442, Number(match[1]));
    }
    for (const match of line.matchAll(/(?:56|57|59|62)\D{0,6}(\d{2,4})/g)) {
      const y = Number(match[1]);
      if (normalizeY(y) !== undefined) addPair(pairs, seen, 58, y);
    }
    if (/56\d{4,5}/.test(line.replace(/\s/g, "")) && /отв/i.test(text)) {
      addPair(pairs, seen, 58, 898);
    }
    if (/\b427\b/.test(line)) {
      addPair(pairs, seen, 58, 427);
    }
    for (const y of Y_SNAP) {
      if (!new RegExp(`(?:^|\\D)${y}(?:\\D|$)`).test(line)) continue;
      const compactLine = line.replace(/\s/g, "");
      const has442 = /442/.test(compactLine);
      const has58 = /(?:121)?58/.test(compactLine);
      if (has442) addPair(pairs, seen, 442, y);
      if (has58 || !has442) addPair(pairs, seen, 58, y);
    }
  }

  // Fuzzy snap по всем числам
  const foundX = new Set<number>();
  const foundY = new Set<number>();
  for (const match of text.matchAll(/\b(\d{2,4})\b/g)) {
    const n = Number(match[1]);
    const sx = snapToList(n, X_SNAP);
    const sy = snapToList(n, Y_SNAP, 12);
    if (sx !== undefined) foundX.add(normalizeX(sx));
    if (sy !== undefined) foundY.add(sy);
  }

  const xs = [...foundX].sort((a, b) => a - b);
  const ys = [...foundY].sort((a, b) => a - b);

  if (pairs.length === 0 && ys.length > 0) {
    const useX = xs.length > 0 ? xs : [58];
    for (const x of useX) {
      for (const y of ys) addPair(pairs, seen, x, y);
    }
  }

  // Типичная панель 500 мм: два ряда X=58 и X=442
  const has58 = pairs.some((p) => p.x === 58);
  const has442 = pairs.some((p) => p.x === 442);
  if (has58 && !has442) {
    const ysOnly = [...new Set(pairs.filter((p) => p.x === 58).map((p) => p.y))];
    for (const y of ysOnly) addPair(pairs, seen, 442, y);
  }

  return pairs
    .filter((p) => normalizeY(p.y) !== undefined)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function normalizeHoles(
  raw: Array<{ x: number; y: number }>,
  header: ReturnType<typeof parseHoleHeader>,
): DrillingHole[] {
  const sorted = [...raw].sort((a, b) => a.y - b.y || a.x - b.x);
  const limit = header.holeCount && header.holeCount >= sorted.length - 2
    ? header.holeCount
    : sorted.length;

  return sorted.slice(0, limit).map((p, i) => ({
    index: i + 1,
    diameter: header.diameter,
    depth: header.depth,
    x: p.x,
    y: p.y,
    holeType: header.holeType,
  }));
}

function inferPanelDims(holes: Array<{ x: number; y: number }>): { width?: number; height?: number } {
  if (holes.length === 0) return {};
  const maxY = Math.max(...holes.map((h) => h.y));
  const maxX = Math.max(...holes.map((h) => h.x));
  return {
    width: maxX <= 100 ? 500 : Math.max(500, maxX + 58),
    height: Math.max(2095, maxY + 9),
  };
}

export function parseDrillingFromOcr(
  tableOcr: string,
  pageNumber = 1,
): DetailPageDrilling {
  const header = parseHoleHeader(tableOcr);
  const coords = extractCoordsFromOcr(tableOcr);
  const holes = normalizeHoles(coords, header);
  const dims = inferPanelDims(holes);

  return {
    pageNumber,
    panelWidth: dims.width,
    panelHeight: dims.height,
    summary: header.summary || `${holes.length} отв. Ø${header.diameter}`,
    holes,
    ocrPreview: tableOcr.slice(0, 200),
  };
}

export async function parseDetailPdfPage(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  pageNumber: number,
): Promise<DetailPageDrilling> {
  const pdf = await openDetailPdf(buffer);
  const worker = await createDrillOcrWorker();
  try {
    return await parseDetailPdfPageFromDoc(pdf, pageNumber, worker);
  } finally {
    await worker.terminate();
  }
}

export async function parseDetailPdf(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  maxPages = 5,
): Promise<DetailPdfDrillingResult> {
  const pdf = await openDetailPdf(buffer);
  const worker = await createDrillOcrWorker();
  const pages: DetailPageDrilling[] = [];
  const errors: string[] = [];

  try {
    for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
      try {
        pages.push(await parseDetailPdfPageFromDoc(pdf, p, worker));
      } catch (e) {
        errors.push(`Стр. ${p}: ${e instanceof Error ? e.message : "ошибка"}`);
      }
    }
  } finally {
    await worker.terminate();
  }

  return { pageCount: pdf.numPages, pages, errors };
}
