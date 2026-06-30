/** Извлекает номер модуля из названия детали: M1_Боковина → "1", M16_Дно → "16" */
export function extractModuleFromName(name: string): string | null {
  const trimmed = name.trim();
  const patterns = [
    /^[MmМ]\s*(\d+)\s*[_\-—]/,
    /^[MmМ](\d+)_/,
    /\b[MmМ]\s*(\d+)\s*[_\-—]/,
    /\b[MmМ](\d+)[_\-—]/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function resolvePartModule(part: {
  module?: string | null;
  name: string;
}): string | null {
  const stored = part.module?.trim();
  if (stored) return stored;
  return extractModuleFromName(part.name);
}

export function formatModuleLabel(module: string | null | undefined): string {
  if (!module) return "Без модуля";
  return `Модуль ${module}`;
}

export type ModuleGroup<T> = {
  module: string;
  label: string;
  parts: T[];
};

export function groupPartsByModule<T extends { module?: string | null; name: string }>(
  parts: T[],
): ModuleGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const part of parts) {
    const key = resolvePartModule(part) ?? "__none__";
    const list = map.get(key) ?? [];
    list.push(part);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      const aNum = parseInt(a, 10);
      const bNum = parseInt(b, 10);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
      return a.localeCompare(b, "ru", { numeric: true });
    })
    .map(([module, moduleParts]) => ({
      module,
      label: module === "__none__" ? "Без модуля" : `Модуль ${module}`,
      parts: moduleParts,
    }));
}

export function groupEntriesByModule<T extends { module?: string | null; name: string }>(
  entries: T[],
): ModuleGroup<T>[] {
  return groupPartsByModule(entries);
}
