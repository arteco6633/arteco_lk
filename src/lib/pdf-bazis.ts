import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";
import type { ParsedPdfPart, PdfParseResult } from "./pdf-parts";

const PAGE_NUMBER = 2;
const RENDER_SCALE = 3;
const CROP_LEFT_RATIO = 0.52;
const ROW_COUNT = 32;
const DATA_START_Y_RATIO = 0.325;
const ROW_HEIGHT_RATIO = 0.0185;

const KNOWN_PART_NAMES = [
  "Стойка",
  "Крыша",
  "Дно",
  "Полка",
  "Перегородка",
  "Бок",
  "Фасад",
  "Цоколь",
  "Бок ящика",
  "Фронт / зад ящика",
  "Задняя стенка",
] as const;

type KnownPartName = (typeof KNOWN_PART_NAMES)[number];

const NAME_FIXES: Record<string, string> = {
  стооко: "Стойка",
  стодко: "Стойка",
  стойко: "Стойка",
  стока: "Стойка",
  слоака: "Стойка",
  сповко: "Стойка",
  гтовко: "Стойка",
  естоко: "Стойка",
  стойка: "Стойка",
  спонка: "Полка",
  полка: "Полка",
  пока: "Полка",
  monka: "Полка",
  nonka: "Полка",
  крышо: "Крыша",
  крыша: "Крыша",
  meкrыша: "Крыша",
  meкрыша: "Крыша",
  mekpawa: "Крыша",
  wkpawa: "Крыша",
  mecwie: "Крыша",
  mepezoposka: "Перегородка",
  mepemapeie: "Перегородка",
  mtepemapeie: "Перегородка",
  mлеревоводка: "Перегородка",
  млеревоводка: "Перегородка",
  mifepecoposxka: "Перегородка",
  minepesopone: "Перегородка",
  m3mepezoposka: "Перегородка",
  mnepezopodka: "Перегородка",
  перегоровка: "Перегородка",
  перегородка: "Перегородка",
  перегородко: "Перегородка",
  бокобино: "Бок",
  бокобуно: "Бок",
  боковина: "Бок",
  bokobuna: "Бок",
  bokobino: "Бок",
  bokobwwe: "Бок",
  uokons: "Цоколь",
  zmwo: "Дно",
  фасоо: "Фасад",
  фасад: "Фасад",
  фасай: "Фасад",
  sox: "Фасад",
  seox: "Фасад",
  m3eacad: "Фасад",
  m3eocnd: "Фасад",
  mew: "Фасад",
  goxobuwe: "Цоколь",
  goxobwwe: "Цоколь",
  igoxobuwe: "Цоколь",
  igoxobwwe: "Цоколь",
  goxobuaa: "Цоколь",
  iboxsbns: "Цоколь",
  ивоковона: "Цоколь",
  цоколь: "Цоколь",
  lokone: "Цоколь",
  moses: "Цоколь",
  mobo: "Бок ящика",
  mbox: "Бок ящика",
  miso: "Бок ящика",
  бокящика: "Бок ящика",
  box: "Бок ящика",
  бок: "Бок",
  дно: "Дно",
  memeo: "Дно",
  menon: "Дно",
  wise: "Задняя стенка",
  wesc: "Задняя стенка",
  wma: "Крыша",
  mee: "Крыша",
  ooponn: "Фронт / зад ящика",
  зай: "Фронт / зад ящика",
  фронт: "Фронт / зад ящика",
  "3c": "Задняя стенка",
  "3.c": "Задняя стенка",
};

const MATERIAL_RE = /(лдсп|мдф|дсп|хдф)[^\n]*/i;
const PANEL_SECTION_RE = /спецификац/i;
const HARDWARE_SECTION_RE = /спецификация\s+(?:на\s+)?фурнитур/i;
const CYRILLIC_NAME = /[а-яёА-ЯЁ]{2,}/;

function toUint8Array(buffer: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  if (Buffer.isBuffer(buffer)) return Uint8Array.from(buffer);
  if (buffer instanceof Uint8Array) return Uint8Array.from(buffer);
  return new Uint8Array(buffer.slice(0));
}

type TableCanvas = {
  canvas: Canvas;
  cropWidth: number;
  cropHeight: number;
};

export async function renderTableCanvas(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  pageNumber: number,
): Promise<TableCanvas> {
  const data = toUint8Array(buffer);
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;

  if (pageNumber > pdf.numPages) {
    throw new Error(`В PDF только ${pdf.numPages} стр., а нужна страница ${pageNumber}`);
  }

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const fullCanvas = createCanvas(viewport.width, viewport.height);
  const context = fullCanvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: fullCanvas as unknown as HTMLCanvasElement,
  }).promise;

  const cropWidth = Math.floor(fullCanvas.width * CROP_LEFT_RATIO);
  const cropped = createCanvas(cropWidth, fullCanvas.height);
  const cropCtx = cropped.getContext("2d");
  cropCtx.drawImage(
    fullCanvas as never,
    0,
    0,
    cropWidth,
    fullCanvas.height,
    0,
    0,
    cropWidth,
    fullCanvas.height,
  );

  return { canvas: cropped, cropWidth, cropHeight: cropped.height };
}

export async function renderPdfPageToPng(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  pageNumber: number,
): Promise<Buffer> {
  const { canvas } = await renderTableCanvas(buffer, pageNumber);
  return canvas.toBuffer("image/png");
}

async function ocrTableRowTexts(
  source: Canvas,
  cropWidth: number,
): Promise<string[]> {
  const worker = await Tesseract.createWorker("rus+eng");
  const dataStartY = Math.floor(source.height * DATA_START_Y_RATIO);
  const rowH = Math.max(30, Math.floor(source.height * ROW_HEIGHT_RATIO));
  const rows: string[] = [];

  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });

  for (let i = 0; i < ROW_COUNT; i++) {
    const y = dataStartY + i * rowH;
    if (y + rowH > source.height) break;

    const strip = createCanvas(cropWidth, rowH + 2);
    strip
      .getContext("2d")
      .drawImage(source as never, 0, y, cropWidth, rowH + 2, 0, 0, cropWidth, rowH + 2);

    const { data } = await worker.recognize(strip.toBuffer("image/png"));
    rows.push(data.text.replace(/\s+/g, " ").trim());
  }

  await worker.terminate();
  return trimDataRows(rows);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fixName(raw: string): KnownPartName | string {
  const key = raw.toLowerCase().replace(/[^a-zа-яё]/gi, "");
  if (NAME_FIXES[key]) return NAME_FIXES[key];

  let best: KnownPartName | undefined;
  let bestDist = Infinity;
  for (const known of KNOWN_PART_NAMES) {
    const dist = levenshtein(key, known.toLowerCase().replace(/[^a-zа-яё]/gi, ""));
    if (dist < bestDist) {
      bestDist = dist;
      best = known;
    }
  }
  if (best && bestDist <= 4) return best;

  const cleaned = raw.replace(/[^А-Яа-яA-Za-zёЁ\/\s]/g, "").trim();
  if (!cleaned) return raw;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function canonicalCode(module: string, name: string): string {
  const mod = module.replace(/[^0-9]/g, "") || "1";
  const shortName = name.replace(/\s+/g, "").replace(/\//g, "");
  return `М${mod}-${shortName}`;
}

function isValidPartName(name: string): name is KnownPartName | string {
  if (name.length < 2) return false;
  if (/^(ese|ess|jun|jui|soo|fun|fuss|ib|ul|wh|fam|ev|jos|sw|ee0|eno)$/i.test(name)) return false;
  if (/лдсп|мдф|дсп|хдф|ubem|цвет/i.test(name)) return false;
  return CYRILLIC_NAME.test(name) || KNOWN_PART_NAMES.includes(name as KnownPartName);
}

function expandMergedNumbers(raw: string): string {
  return raw.replace(/(\d{3,4})(\d{3})(?!\d)/g, "$1 $2");
}

function normalizeDim(n: number): number {
  if (n >= 1500 && n <= 1600) return n - 1000;
  return n;
}

function extractNumbers(line: string, position?: number): number[] {
  const expanded = expandMergedNumbers(line);
  const nums: number[] = [];
  for (const match of expanded.matchAll(/\b(\d{3,4})\b/g)) {
    const n = normalizeDim(Number(match[1]));
    if (n >= 100) nums.push(n);
  }
  if (position && nums[0] === position) return nums.slice(1);
  return nums;
}

function extractQuantity(line: string, position: number): number {
  const afterPos = line.replace(new RegExp(`^\\s*\\[?${position}\\]?\\s*`), "");
  const match = afterPos.match(/(?:^|[\s|])(\d{1,2})(?:\s|$|\[)/);
  if (match) {
    const n = Number(match[1]);
    if (n > 0 && n <= 32 && n !== position) return n;
  }
  const qtyAfterName = afterPos.match(/[А-Яа-яA-Za-zёЁ]{3,}\s+(\d{1,2})\s/);
  if (qtyAfterName) {
    const n = Number(qtyAfterName[1]);
    if (n > 0 && n <= 32) return n;
  }
  return 1;
}

function extractDimensions(nums: number[]): string | undefined {
  if (nums.length >= 4) {
    return `${nums[2]}×${nums[3]}`;
  }
  if (nums.length >= 2) {
    return `${nums[nums.length - 2]}×${nums[nums.length - 1]}`;
  }
  if (nums.length === 1) {
    return String(nums[0]);
  }
  return undefined;
}

function findNameInLine(line: string): KnownPartName | string | undefined {
  const lower = line.toLowerCase();
  const keys = Object.keys(NAME_FIXES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length < 3) continue;
    if (lower.includes(key)) return NAME_FIXES[key];
  }
  for (const known of KNOWN_PART_NAMES) {
    if (lower.includes(known.toLowerCase())) return known;
  }
  return undefined;
}

type CodeMatch = { module: string; rawName: string };

function findCodeInLine(line: string): CodeMatch | undefined {
  const patterns = [
    /[МM](\d+)\s*[_\-—]\s*([А-Яа-яA-Za-zёЁ][А-Яа-яA-Za-zёЁ\s/.]{1,20})/i,
    /[МM](\d+)\s*[_\-—]([A-Za-zА-Яа-яёЁ]{2,})/,
    /[МM]\s*(\d+)\s*[-–_]\s*([А-Яа-яA-Za-zёЁ]{2,})/i,
    /[МM](\d+)([A-Za-zА-Яа-яёЁ]{4,})/,
    /(?:^|[\s|(Г])(?:[МM]\s*)?(\d)\s+([А-Яа-яЁё]{3,})/,
    /(?:^|[\s|(Г])([МM])(\d)\s+([А-Яа-яЁё]{3,})/,
    /[МM][еe]?\s*[-–_]?\s*([А-Яа-яA-Za-zёЁ]{4,})/i,
    /[МM]о\s*[-–_]\s*([А-Яа-яA-Za-zёЁ]{3,})/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;

    if (pattern.source.includes("[еe]") && !pattern.source.includes("(\\d+)")) {
      return { module: "1", rawName: match[1] };
    }
    if (pattern.source.includes("МM]о")) {
      return { module: "1", rawName: match[1] };
    }
    if (pattern.source.includes("(?:\\^|[\\s|(Г])(?:[МM]")) {
      const mod = match[1];
      const rawName = match[2];
      if (mod && rawName) return { module: mod, rawName };
    }
    if (pattern.source.includes("(?:\\^|[\\s|(Г])([МM])")) {
      return { module: match[2], rawName: match[3] };
    }

    const module = match[1];
    const rawName = match[2];
    if (module && rawName) {
      return { module, rawName: rawName.trim() };
    }
  }

  const boxMatch = line.match(/[МM](\d+)\s*box\s*([а-яёА-Яa-zA-Z]*)/i);
  if (boxMatch) {
    return { module: boxMatch[1], rawName: "box ящика" };
  }

  const zcMatch = line.match(/[МM](\d+)\s*[_\-—.]?\s*3\s*[.cс]/i);
  if (zcMatch) {
    return { module: zcMatch[1], rawName: "3c" };
  }

  return undefined;
}

function trimDataRows(rows: string[]): string[] {
  const end = rows.findIndex((r) => /фурнитур|лдсп.*мм/i.test(r));
  const slice = end === -1 ? rows : rows.slice(0, end);
  return slice.slice(0, ROW_COUNT);
}

function extractPosition(line: string, fallback: number): number {
  const leading = line.match(/^[\[\s|]*(\d{1,2})\b/);
  if (leading) {
    const n = Number(leading[1]);
    if (n >= 1 && n <= 32) return n;
  }
  return fallback;
}

function isGarbageLine(line: string): boolean {
  if (line.length < 4) return true;
  if (findCodeInLine(line) || findNameInLine(line)) return false;
  if (/^(гно|reno|mol|tome|поз|обозн|наимен)/i.test(line)) return true;
  const hasPartHint =
    /[МM]\s*\d|стой|полк|крыш|дно|фасад|цокол|перегор|ящик|бок|зад|фронт|sox|box|goxo|memo|wise|wesc/i.test(
      line,
    );
  const hasDims = (line.match(/\d{3,4}/g) ?? []).length >= 2;
  return !hasPartHint && !hasDims;
}

function parseTableLine(line: string, position: number): ParsedPdfPart | null {
  if (/^(поз|обозн|наименование|кол|длина|ширина|заготовка|готовая)/i.test(line)) return null;
  if (isGarbageLine(line)) return null;

  const codeMatch = findCodeInLine(line);
  let module = "1";
  let name: string | undefined;

  if (codeMatch) {
    module = codeMatch.module;
    name = fixName(codeMatch.rawName);
  } else {
    name = findNameInLine(line);
    if (name) {
      const modMatch = line.match(/[МM]\s*(\d+)/i);
      module = modMatch?.[1] ?? "1";
    }
  }

  if (!name || !isValidPartName(name)) return null;

  const nums = extractNumbers(line, position);
  if (nums.length === 0) return null;

  const quantity = extractQuantity(line, position);
  const dimensions = extractDimensions(nums);
  const code = canonicalCode(module, name);

  return { name, code, dimensions, quantity, sourceLine: position };
}

export function parseBazisTableRows(rows: string[]): PdfParseResult {
  const errors: string[] = [];
  const previewLines = rows.filter(Boolean);
  const parts: ParsedPdfPart[] = [];

  for (let i = 0; i < rows.length; i++) {
    const line = rows[i]?.trim();
    if (!line) continue;

    const position = extractPosition(line, i + 1);
    const parsed = parseTableLine(line, position);
    if (!parsed) continue;

    parts.push({ ...parsed, sourceLine: position });
  }

  parts.sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0));

  if (parts.length === 0) {
    errors.push(
      "Не удалось распознать таблицу «Спецификация на панели». Убедитесь, что 2-я страница содержит эту таблицу.",
    );
  } else if (parts.length < 28) {
    errors.push(
      `Распознано ${parts.length} из ~32 позиций. Проверьте список — возможно, часть строк нужно поправить вручную.`,
    );
  }

  return {
    parts,
    pageNumber: PAGE_NUMBER,
    rawLineCount: rows.length,
    errors,
    previewLines: previewLines.slice(0, 32),
  };
}

export function parseBazisPanelText(text: string): PdfParseResult {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const startIdx = lines.findIndex((l) => PANEL_SECTION_RE.test(l) && /панел/i.test(l));
  const endIdx = lines.findIndex(
    (l, i) => i > (startIdx === -1 ? 0 : startIdx) && HARDWARE_SECTION_RE.test(l),
  );

  const sliceStart = startIdx === -1 ? 0 : startIdx + 1;
  const sliceEnd = endIdx === -1 ? lines.length : endIdx;
  const tableLines = lines.slice(sliceStart, sliceEnd);

  const materialMatch = text.match(MATERIAL_RE);
  const defaultMaterial = materialMatch?.[0]?.trim();

  const result = parseBazisTableRows(tableLines);
  if (defaultMaterial) {
    result.parts = result.parts.map((p) => ({ ...p, material: defaultMaterial }));
  }
  return result;
}

export async function ocrPdfPage(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  pageNumber = PAGE_NUMBER,
): Promise<string> {
  const png = await renderPdfPageToPng(buffer, pageNumber);
  const result = await Tesseract.recognize(png, "rus+eng");
  return result.data.text;
}

export async function parsePartsFromBazisPdf(
  buffer: ArrayBuffer | Uint8Array | Buffer,
): Promise<PdfParseResult & { method: "ocr" }> {
  const { canvas, cropWidth } = await renderTableCanvas(buffer, PAGE_NUMBER);
  const rowTexts = await ocrTableRowTexts(canvas, cropWidth);
  const rowResult = parseBazisTableRows(rowTexts);

  const text = await ocrPdfPage(buffer, PAGE_NUMBER);
  const pageResult = parseBazisPanelText(text);

  const merged = new Map<number, ParsedPdfPart>();
  for (const part of pageResult.parts) {
    if (part.sourceLine) merged.set(part.sourceLine, part);
  }
  for (const part of rowResult.parts) {
    if (!part.sourceLine) continue;
    const existing = merged.get(part.sourceLine);
    if (!existing || (part.dimensions && !existing.dimensions)) {
      merged.set(part.sourceLine, { ...existing, ...part, name: part.name, dimensions: part.dimensions ?? existing?.dimensions });
    }
  }

  const parts = [...merged.values()].sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0));
  const errors: string[] = [];
  if (parts.length === 0) {
    errors.push(rowResult.errors[0] ?? pageResult.errors[0] ?? "Не удалось распознать таблицу.");
  } else if (parts.length < 28) {
    errors.push(
      `Распознано ${parts.length} из ~32 позиций. Проверьте список — возможно, часть строк нужно поправить вручную.`,
    );
  }

  const materialMatch = text.match(MATERIAL_RE);
  const defaultMaterial = materialMatch?.[0]?.trim();
  const withMaterial = defaultMaterial
    ? parts.map((p) => ({ ...p, material: p.material ?? defaultMaterial }))
    : parts;

  return {
    parts: withMaterial,
    pageNumber: PAGE_NUMBER,
    rawLineCount: rowTexts.length,
    errors,
    previewLines: rowTexts.slice(0, 32),
    method: "ocr",
  };
}
