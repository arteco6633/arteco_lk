import { parsePartsFromLines, type LineCluster } from "../src/lib/pdf-parts";

function line(y: number, parts: Array<[number, string]>): LineCluster {
  return {
    y,
    items: parts.map(([x, text]) => ({ x, text })),
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Таблица как у технолога
const tableLines: LineCluster[] = [
  line(500, [
    [40, "Наименование"],
    [180, "Код"],
    [260, "Размер"],
    [360, "Кол-во"],
    [430, "Материал"],
  ]),
  line(480, [
    [40, "Боковина левая"],
    [180, "B-01"],
    [260, "720x560"],
    [360, "1"],
    [430, "ЛДСП 18"],
  ]),
  line(460, [
    [40, "Полка"],
    [180, "P-02"],
    [260, "680x400"],
    [360, "2"],
    [430, "ЛДСП 18"],
  ]),
  line(440, [
    [40, "Фасад"],
    [180, "F-01"],
    [260, "716x397"],
    [360, "1"],
    [430, "МДФ"],
  ]),
];

const result = parsePartsFromLines(tableLines);
assert(result.parts.length >= 2, `Expected at least 2 parts, got ${result.parts.length}`);
assert(result.parts.some((p) => p.name.includes("Боковина")), "Should find Боковина");
assert(result.parts.some((p) => p.dimensions?.includes("720")), "Should find dimensions");

// Эвристика без явной шапки
const heuristicLines: LineCluster[] = [
  line(300, [[40, "Боковина левая 720x560 1 ЛДСП 18"]]),
  line(280, [[40, "Полка 680x400 2"]]),
];

const heuristic = parsePartsFromLines(heuristicLines);
assert(heuristic.parts.length >= 1, "Heuristic should parse at least 1 part");

console.log("PDF parser tests passed ✓");
console.log("Parsed:", result.parts.map((p) => `${p.name} ${p.dimensions ?? ""} x${p.quantity}`).join("; "));
