import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";

const path =
  process.argv[2] ??
  "uploads/documents/cmqveicsr000e8z0hl8s3ehtn/f7111b8a-a19b-4df0-b2e0-677800d72a5b.pdf";

async function renderPage(pdfPath: string, pageNumber: number) {
  const data = new Uint8Array(readFileSync(pdfPath));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 3 });
  const fullCanvas = createCanvas(viewport.width, viewport.height);
  const context = fullCanvas.getContext("2d");
  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: fullCanvas as unknown as HTMLCanvasElement,
  }).promise;

  // Таблица слева — обрезаем правую часть с чертежом
  const cropWidth = Math.floor(fullCanvas.width * 0.52);
  const canvas = createCanvas(cropWidth, fullCanvas.height);
  const cropCtx = canvas.getContext("2d");
  cropCtx.drawImage(
    fullCanvas as unknown as import("@napi-rs/canvas").Canvas,
    0,
    0,
    cropWidth,
    fullCanvas.height,
    0,
    0,
    cropWidth,
    fullCanvas.height,
  );
  return canvas.toBuffer("image/png");
}

async function main() {
  console.log("Rendering page 2...");
  const png = await renderPage(path, 2);
  writeFileSync("/tmp/mebel-page2.png", png);
  console.log("OCR running...");
  const result = await Tesseract.recognize(png, "rus+eng", {
    logger: (m) => {
      if (m.status === "recognizing text") process.stdout.write(`\rOCR ${Math.round(m.progress * 100)}%`);
    },
  });
  console.log("\n--- OCR TEXT ---\n");
  console.log(result.data.text);
}

main().catch(console.error);
