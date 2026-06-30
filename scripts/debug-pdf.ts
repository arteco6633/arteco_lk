import { readFileSync } from "fs";
import { extractPdfPageLines, parsePartsFromPdfPage2 } from "../src/lib/pdf-parts";

function lineText(line: { items: Array<{ text: string; x: number }> }): string {
  return line.items
    .sort((a, b) => a.x - b.x)
    .map((i) => i.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

const path =
  process.argv[2] ??
  "uploads/documents/cmqveicsr000e8z0hl8s3ehtn/f7111b8a-a19b-4df0-b2e0-677800d72a5b.pdf";

async function main() {
  const data = readFileSync(path);
  const lines = await extractPdfPageLines(data, 2);
  console.log("Total lines:", lines.length);
  console.log("--- All lines ---");
  lines.forEach((l, i) => console.log(String(i + 1).padStart(3), "|", lineText(l)));

  const result = await parsePartsFromPdfPage2(data);
  console.log("\n--- Parsed parts:", result.parts.length, "---");
  result.parts.forEach((p) =>
    console.log(`${p.name} | ${p.code ?? "-"} | ${p.dimensions ?? "-"} | x${p.quantity}`),
  );
}

main().catch(console.error);
