import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const path =
  process.argv[2] ?? "/Users/anastasiashorohova/Downloads/Прихожая. деталировка.pdf";

async function main() {
  const buf = readFileSync(path);
  const data = new Uint8Array(buf);
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;

  console.log("File:", path);
  console.log("Pages:", pdf.numPages);

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string; transform: number[] }>;
    const text = items
      .filter((i) => i.str?.trim())
      .map((i) => i.str!.trim())
      .join(" ");

    console.log(`\n--- Page ${p} (${Math.round(vp.width)}×${Math.round(vp.height)}) ---`);
    console.log("Text items:", items.filter((i) => i.str?.trim()).length);
    console.log("Sample:", text.slice(0, 300) || "(no text)");

    if (p <= 3) {
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;
      const out = `/tmp/mebel-detail-p${p}.png`;
      writeFileSync(out, canvas.toBuffer("image/png"));
      console.log("Saved preview:", out);
    }
  }
}

main().catch(console.error);
