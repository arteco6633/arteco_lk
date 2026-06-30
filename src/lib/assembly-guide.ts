import type { AssemblyGuideEntry } from "./pdf-assembly";
import { foldCodeString, digitsOnly } from "./part-search";
import { extractModuleFromName, formatModuleLabel, resolvePartModule } from "./module";

export type PartForGuide = {
  id: string;
  code: string | null;
  specNumber: number | null;
  name: string;
  module?: string | null;
  dimensions: string | null;
  length: string | null;
  width: string | null;
  quantity: number;
  material?: string | null;
};

export function partDimensionsText(part: PartForGuide): string | undefined {
  if (part.length && part.width) return `${part.length}×${part.width}`;
  return part.dimensions ?? undefined;
}

/** Спецификация из данных системы (Excel) — надёжнее, чем OCR чертежа */
export function entriesFromSystemParts(parts: PartForGuide[]): AssemblyGuideEntry[] {
  const seen = new Set<string>();
  const entries: AssemblyGuideEntry[] = [];

  for (const part of parts) {
    const position = part.code?.trim();
    if (!position) continue;
    const module = resolvePartModule(part) ?? undefined;
    const key = module ? `${module}:${position}` : position;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      position,
      name: part.name,
      module,
      dimensions: partDimensionsText(part),
      quantity: part.quantity,
    });
  }

  return entries.sort((a, b) => {
    const aNum = parseInt(a.position, 10);
    const bNum = parseInt(b.position, 10);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
    return a.position.localeCompare(b.position, "ru", { numeric: true });
  });
}

export type AssemblyHint = {
  partId: string;
  entry: AssemblyGuideEntry;
  matchBy: "position" | "name" | "dimensions";
};

function normalizeDimensions(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, "").replace(/[xх×]/gi, "x").toLowerCase();
}

function partDimensions(part: PartForGuide): string {
  return partDimensionsText(part) ?? "";
}

export function matchPartToGuideEntry(
  part: PartForGuide,
  entry: AssemblyGuideEntry,
): AssemblyHint["matchBy"] | null {
  const partModule = resolvePartModule(part);
  const entryModule = entry.module ?? extractModuleFromName(entry.name) ?? null;
  if (partModule && entryModule && partModule !== entryModule) {
    return null;
  }

  const poz = entry.position.trim();
  const partCode = part.code?.trim() ?? "";

  if (poz && partCode && (partCode === poz || digitsOnly(partCode) === digitsOnly(poz))) {
    return "position";
  }

  if (poz && part.specNumber != null && String(part.specNumber) === poz) {
    return "position";
  }

  const entryName = foldCodeString(entry.name);
  const partName = foldCodeString(part.name);
  if (entryName && partName && (entryName === partName || partName.includes(entryName) || entryName.includes(partName))) {
    return "name";
  }

  const partDim = normalizeDimensions(partDimensions(part));
  const entryDim = normalizeDimensions(entry.dimensions);
  if (partDim && entryDim && partDim === entryDim) {
    return "dimensions";
  }

  return null;
}

export function buildAssemblyHints(
  parts: PartForGuide[],
  entries: AssemblyGuideEntry[],
): Map<string, AssemblyHint> {
  const hints = new Map<string, AssemblyHint>();

  for (const part of parts) {
    for (const entry of entries) {
      const matchBy = matchPartToGuideEntry(part, entry);
      if (matchBy) {
        hints.set(part.id, { partId: part.id, entry, matchBy });
        break;
      }
    }
  }

  return hints;
}

export function findGuideEntryForPart(
  part: PartForGuide,
  entries: AssemblyGuideEntry[],
): AssemblyGuideEntry | null {
  for (const entry of entries) {
    if (matchPartToGuideEntry(part, entry)) return entry;
  }
  return null;
}

export function formatAssemblyHint(part: PartForGuide, entry: AssemblyGuideEntry): string {
  const size = entry.dimensions ? `, размер ${entry.dimensions}` : "";
  const module = resolvePartModule(part) ?? entry.module ?? extractModuleFromName(entry.name);
  const moduleText = module ? `${formatModuleLabel(module)} — ` : "";
  return `На чертеже слева — ${moduleText}позиция ${entry.position}: ${entry.name}${size}. Найдите деталь с Поз. ${part.code ?? entry.position}.`;
}

export function formatPartSortHint(part: PartForGuide): string {
  const module = resolvePartModule(part);
  const mod = module ? `${formatModuleLabel(module)} — ` : "";
  const size = partDimensionsText(part);
  const sizeText = size ? `, размер ${size}` : "";
  return `${mod}Поз. ${part.code ?? "—"}: ${part.name}${sizeText}. Положите деталь в ячейку этого модуля.`;
}
