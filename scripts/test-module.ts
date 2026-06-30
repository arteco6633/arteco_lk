import assert from "node:assert/strict";
import {
  extractModuleFromName,
  groupPartsByModule,
  resolvePartModule,
} from "../src/lib/module";

assert.equal(extractModuleFromName("M9_Крышка"), "9");
assert.equal(extractModuleFromName("M1_Боковина"), "1");
assert.equal(extractModuleFromName("M16_Дно"), "16");
assert.equal(extractModuleFromName("Боковина"), null);

const grouped = groupPartsByModule([
  { name: "M1_Боковина", module: null },
  { name: "M1_Полка", module: "1" },
  { name: "M4_Фасад", module: null },
]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].module, "1");
assert.equal(grouped[0].parts.length, 2);
assert.equal(grouped[1].module, "4");

assert.equal(resolvePartModule({ name: "M2_Стойка", module: null }), "2");
assert.equal(resolvePartModule({ name: "Полка", module: "5" }), "5");

console.log("module tests ok");
