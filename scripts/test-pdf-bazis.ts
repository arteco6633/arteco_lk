import { readFileSync } from "fs";
import { parsePartsFromPdfPage2 } from "../src/lib/pdf-parts";
import { parseBazisPanelText } from "../src/lib/pdf-bazis";

const SAMPLE_OCR = `
Спецификация на панели
1 | |М3-Стойка [1 [2094 [554 [2094 [554
2 | |М3-Полка [1 [527 [500 [527 [500
3 | |М2-Полка [3 [518 [559 [518 [559
Спецификация на фурнитуру и покупные изделия
1 - 1 в цвет ЛДСП(16мм)
`;

async function main() {
  const sample = parseBazisPanelText(SAMPLE_OCR);
  console.log("Sample parse:", sample.parts.length, "parts");
  sample.parts.forEach((p) =>
    console.log(`  ${p.code} | ${p.name} | ${p.dimensions} | x${p.quantity}`),
  );

  const path =
    process.argv[2] ??
    "uploads/documents/cmqveicsr000e8z0hl8s3ehtn/f7111b8a-a19b-4df0-b2e0-677800d72a5b.pdf";

  console.log("\nParsing real PDF (OCR may take ~10s)...");
  const result = await parsePartsFromPdfPage2(readFileSync(path));
  console.log(`Method: ${result.method}, Parts: ${result.parts.length}`);
  result.parts.slice(0, 15).forEach((p) =>
    console.log(`  ${p.code} | ${p.name} | ${p.dimensions ?? "-"} | x${p.quantity}`),
  );
  if (result.parts.length > 15) console.log(`  ... и ещё ${result.parts.length - 15}`);
}

main().catch(console.error);
