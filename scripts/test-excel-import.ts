import * as XLSX from "xlsx";
import {
  buildBazisSpecificationWorkbook,
  buildSplitSpecificationWorkbook,
} from "../src/lib/excel-export";
import {
  formatCell,
  normalizeProductNumber,
  parseBazisSpecification,
  parseHardwareExcel,
  parsePartsExcel,
  parseSpecificationExcel,
} from "../src/lib/excel";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildWorkbook(rows: (string | number)[][], sheetName = "Лист1"): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function buildMultiSheetWorkbook(
  sheets: Array<{ name: string; rows: (string | number)[][] }>,
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

// Тест 1: простой шаблон
const partsBuffer = buildWorkbook([
  ["№ изделия", "Название детали", "Код детали", "Размер", "Количество", "Материал"],
  [1, "Боковина левая", "B-01", "720×560", 1, "ЛДСП 18"],
  ["2", "Фасад", "F-01", "716×397", 1, "МДФ"],
]);

const partsResult = parsePartsExcel(partsBuffer);
assert(partsResult.rows.length === 2, `Expected 2 parts, got ${partsResult.rows.length}`);

// Тест 2: спецификация Базис
const bazisBuffer = buildWorkbook([
  ["", "Заказ", "", "2025-001"],
  ["", "Изделие", "", "1 Кухня тест"],
  ["", "Артикул изделия", "", "1"],
  ["", "Спецификация на МДФ 18 мм"],
  [],
  ["№", "Поз.", "Наименование", "Готовая деталь", "", "Кол-во", "Облицовка", "Паз", "Прямоуг."],
  ["", "", "", "Длина", "Ширина", "", "", "", ""],
  [1, 66, "M9_Крышка", 2010, 300, 1, "L$1S$1", "2x10", "1"],
  [2, 67, "M4_Фасад", 750, 776, 1, "", "", ""],
  [],
  ["", "Спецификация на фурнитуру"],
  [],
  ["№", "Артикул", "Наименование", "Кол-во"],
  [1, 69, "Евровинт 7×50", 201],
  [2, 20429, "Стяжка эксцентрик", 115],
]);

const spec = parseSpecificationExcel(bazisBuffer);
assert(spec.parts.length === 2, `Expected 2 bazis parts, got ${spec.parts.length}`);
assert(spec.hardware.length === 2, `Expected 2 hardware, got ${spec.hardware.length}`);
assert(spec.parts[0].code === "66", "Part code from Поз.");
assert(spec.parts[0].specNumber === 1, "Part spec number");
assert(spec.parts[0].length === "2010", "Part length");
assert(spec.parts[0].width === "300", "Part width");
assert(spec.parts[0].dimensions === "2010x300", "Dimensions LxW");
assert(spec.parts[0].edging === "L$1S$1", "Edging");
assert(spec.parts[0].groove === "2x10", "Groove");
assert(spec.parts[0].rectangular === "1", "Rectangular");
assert(!!spec.parts[0].material?.includes("МДФ"), "Material from section header");
assert(spec.parts[0].productNumber === "1", "Product from артикул");
assert(spec.hardware[0].code === "69", "Hardware article separate");
assert(spec.hardware[0].specNumber === 1, "Hardware spec number");
assert(spec.hardware[0].name === "Евровинт 7×50", "Hardware name without merge");

// Тест 3: два материала
const twoMaterials = buildWorkbook([
  ["", "Изделие", "", "1 Шкаф"],
  ["", "Спецификация на ХДФ 3 мм"],
  ["№", "Поз.", "Наименование", "Длина", "Ширина", "Кол-во"],
  [1, 10, "M13_Полка", 564, 300, 1],
  ["", "Спецификация на ЛДСП 18 мм"],
  ["№", "Поз.", "Наименование", "Длина", "Ширина", "Кол-во"],
  [1, 20, "M16_Дно", 1658, 320, 1],
]);

const multi = parseBazisSpecification(twoMaterials);
assert(multi.parts.length === 2, "Two material sections");
assert(!!multi.parts[0].material?.includes("ХДФ"), "HDF material");
assert(!!multi.parts[1].material?.includes("ЛДСП"), "LDSP material");

// Тест 4: многостраничный файл (как split export)
const splitBuffer = buildMultiSheetWorkbook([
  {
    name: "1 МДФ 18",
    rows: [
      ["", "Изделие", "", "1 Кухня"],
      ["", "Спецификация на МДФ 18 мм"],
      ["№", "Поз.", "Наименование", "Длина", "Ширина", "Кол-во"],
      [1, 66, "M9_Крышка", 2010, 300, 1],
    ],
  },
  {
    name: "Фурнитура 1",
    rows: [
      ["", "Изделие", "", "1 Кухня"],
      ["", "Спецификация на фурнитуру"],
      ["№", "Артикул", "Наименование", "Кол-во"],
      [1, 69, "Евровинт 7×50", 201],
    ],
  },
]);

const splitParsed = parseSpecificationExcel(splitBuffer);
assert(splitParsed.parts.length === 1, "Split sheet parts");
assert(splitParsed.hardware.length === 1, "Split sheet hardware");

// Тест 5: round-trip export → import
const exportOrder = {
  number: "2025-001",
  products: [
    {
      number: "1",
      name: "Кухня тест",
      parts: spec.parts.map((p) => ({
        specNumber: p.specNumber,
        name: p.name,
        code: p.code,
        length: p.length,
        width: p.width,
        dimensions: p.dimensions,
        quantity: p.quantity,
        material: p.material,
        edging: p.edging,
        groove: p.groove,
        rectangular: p.rectangular,
      })),
      hardware: spec.hardware.map((h) => ({
        specNumber: h.specNumber,
        code: h.code,
        name: h.name,
        quantity: h.quantity,
        unit: h.unit,
      })),
    },
  ],
};

const bazisExported = buildBazisSpecificationWorkbook(exportOrder);
const roundTrip = parseSpecificationExcel(bazisExported);
assert(roundTrip.parts.length === spec.parts.length, "Round-trip parts count");
assert(roundTrip.hardware.length === spec.hardware.length, "Round-trip hardware count");
assert(roundTrip.parts[0].name === spec.parts[0].name, "Round-trip part name");
assert(roundTrip.parts[0].edging === spec.parts[0].edging, "Round-trip edging");
assert(roundTrip.hardware[0].code === spec.hardware[0].code, "Round-trip hardware code");

const splitExported = buildSplitSpecificationWorkbook(exportOrder);
const splitRoundTrip = parseSpecificationExcel(splitExported);
assert(splitRoundTrip.parts.length === spec.parts.length, "Split round-trip parts");
assert(splitRoundTrip.hardware.length === spec.hardware.length, "Split round-trip hardware");

assert(normalizeProductNumber("1.0") === "1", "Normalize 1.0");
assert(formatCell(1) === "1", "Format cell number");

// Тест 6: № в колонке B (пустая колонка A)
const offsetNumBuffer = buildWorkbook([
  ["", "Изделие", "", "037 Кухня Дедопали 52"],
  ["", "Спецификация на ЛДСП Kronospan 0190 PE Черный"],
  ["", "№", "Поз.", "Наименование", "Длина", "Ширина", "Кол-во"],
  ["", 12, 66, "M9_Крышка", 2010, 300, 1],
  ["", 13.0, 67, "M4_Фасад", 750, 776, 1],
]);

const offsetParsed = parseBazisSpecification(offsetNumBuffer);
assert(offsetParsed.parts.length === 2, "Offset column parts");
assert(offsetParsed.parts[0].specNumber === 12, "Spec number col B");
assert(offsetParsed.parts[1].specNumber === 13, "Spec number from float");
assert(!!offsetParsed.parts[0].material?.includes("Kronospan"), "Section title material");

console.log("All Excel import/export tests passed ✓");
