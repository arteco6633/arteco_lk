import { readFileSync } from "fs";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";

const path =
  process.argv[2] ??
  "/Users/anastasiashorohova/Downloads/Прихожая. деталировка.pdf";
const TABLE_CROP = { left: 0.48, top: 0.64, width: 0.5, height: 0.34 };
const SCALE = Number(process.argv[3] ?? 5);

async function cropPage(pageNum: number) {
  const data = new Uint8Array(readFileSync(path));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(vp.width, vp.height);
  await page.render({
    canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
    viewport: vp,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;
  const x = Math.floor(canvas.width * TABLE_CROP.left);
  const y = Math.floor(canvas.height * TABLE_CROP.top);
  const w = Math.floor(canvas.width * TABLE_CROP.width);
  const h = Math.floor(canvas.height * TABLE_CROP.height);
  const c2 = createCanvas(w, h);
  c2.getContext("2d").drawImage(canvas as never, x, y, w, h, 0, 0, w, h);
  return c2.toBuffer("image/png");
}

async function main() {
  for (const p of [1, 2, 3]) {
    const png = await cropPage(p);
    const r = await Tesseract.recognize(png, "rus+eng");
    console.log(`\n=== page ${p} scale ${SCALE} ===\n`);
    console.log(r.data.text);
  }
}

main().catch(console.error);
