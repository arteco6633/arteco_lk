import { readFileSync } from "fs";
import { parseDetailPdfPage } from "../src/lib/pdf-drilling";

const path =
  process.argv[2] ??
  "/Users/anastasiashorohova/Downloads/Прихожая. деталировка.pdf";

async function main() {
  const buf = readFileSync(path);
  for (const page of [1, 2, 3]) {
    console.log(`\n=== Page ${page} ===`);
    const result = await parseDetailPdfPage(buf, page);
    console.log("Label:", result.partLabel);
    console.log("Panel:", result.panelWidth, "×", result.panelHeight);
    console.log("Summary:", result.summary);
    console.log("Holes:", result.holes.length);
    result.holes.forEach((h) =>
      console.log(`  ${h.index}: Ø${h.diameter} @ (${h.x}, ${h.y}) ${h.holeType}`),
    );
  }
}

main().catch(console.error);
