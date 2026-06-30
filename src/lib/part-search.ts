import type { PartStatus } from "@prisma/client";

/** Нормализует строку размера для сравнения: 2094×554, 2094x554, 2094 554 → единый вид */
export function normalizeDimensionString(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[xх×]/g, "x");
}

/** Только цифры из строки (для поиска по началу числа) */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Умное совпадение: полный размер, начало длины/ширины, фрагмент «2094» или «2094x5».
 */
export function matchesDimensionQuery(dimensions: string | null, query: string): boolean {
  if (!dimensions) return false;
  const q = query.trim();
  if (!q.length) return false;

  const dimNorm = normalizeDimensionString(dimensions);
  const qNorm = normalizeDimensionString(q);

  if (dimNorm.includes(qNorm)) return true;

  const [length, width] = dimNorm.split("x");
  const qDigits = digitsOnly(q);

  if (qDigits.length >= 2) {
    if (length?.startsWith(qDigits) || width?.startsWith(qDigits)) return true;
    if (digitsOnly(dimensions).includes(qDigits)) return true;
  }

  if (qNorm.endsWith("x") && length?.startsWith(digitsOnly(qNorm.slice(0, -1)))) return true;

  return false;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Сводит код к единому виду: без пробелов/дефисов, латиница вместо похожей кириллицы */
export function foldCodeString(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[−–—_\-./\\]/g, "")
    .replace(/[аa]/g, "a")
    .replace(/[вb]/g, "b")
    .replace(/[сc]/g, "c")
    .replace(/[еe]/g, "e")
    .replace(/[кk]/g, "k")
    .replace(/[мm]/g, "m")
    .replace(/[нh]/g, "h")
    .replace(/[оo]/g, "o")
    .replace(/[рp]/g, "p")
    .replace(/[тt]/g, "t")
    .replace(/[хx×]/g, "x")
    .replace(/[уy]/g, "y");
}

/** Поиск по коду / штрихкоду: точное, по подстроке, по цифрам */
export function matchesCodeQuery(code: string | null | undefined, query: string): boolean {
  if (!code) return false;
  const q = query.trim();
  if (!q.length) return false;

  const codeFolded = foldCodeString(code);
  const qFolded = foldCodeString(q);

  if (codeFolded === qFolded) return true;

  // Числовой код: «4» только для кода 4, не для 14 или 40
  if (/^\d+$/.test(q) && /^\d+$/.test(code.trim())) {
    return code.trim() === q;
  }

  if (qFolded.length >= 2 && codeFolded.includes(qFolded)) return true;

  const qDigits = digitsOnly(q);
  if (qDigits.length >= 2) {
    const codeDigits = digitsOnly(code);
    if (codeDigits.includes(qDigits)) return true;
    if (codeFolded.includes(qDigits)) return true;
  }

  return false;
}

/** Поиск по подстроке в названии (без учёта регистра) */
export function matchesTextQuery(field: string | null | undefined, query: string): boolean {
  if (!field) return false;
  const q = normalizeText(query);
  if (q.length < 2) return false;
  return normalizeText(field).includes(q);
}

export type PartSearchFields = {
  name: string;
  code?: string | null;
  dimensions?: string | null;
  length?: string | null;
  width?: string | null;
};

/** Поиск по позиции (Поз.), названию или размеру */
export function matchesPartQuery(part: PartSearchFields, query: string): boolean {
  const q = query.trim();
  if (!q.length) return false;
  if (matchesCodeQuery(part.code, q)) return true;
  if (q.length < 2) return false;
  if (matchesTextQuery(part.name, q)) return true;
  const sizeText =
    part.dimensions ??
    (part.length && part.width ? `${part.length}x${part.width}` : part.length ?? part.width ?? null);
  if (matchesDimensionQuery(sizeText, q)) return true;
  return false;
}

export function filterPartsByQuery<T extends PartSearchFields>(parts: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return [];
  return parts.filter((p) => matchesPartQuery(p, q));
}

/** Поиск только по позиции (Поз. / код детали) */
export function matchesPositionQuery(part: { code?: string | null }, query: string): boolean {
  return matchesCodeQuery(part.code, query);
}

export function filterPartsByPosition<T extends { code?: string | null }>(
  parts: T[],
  query: string,
): T[] {
  const q = query.trim();
  if (!q) return [];
  return parts.filter((p) => matchesPositionQuery(p, q));
}

export type PartSearchRow = {
  id: string;
  specNumber: number | null;
  name: string;
  code: string | null;
  length: string | null;
  width: string | null;
  dimensions: string | null;
  quantity: number;
  material: string | null;
  module?: string | null;
  sectionOrder: number | null;
  status: PartStatus;
  product: {
    id: string;
    number: string;
    name: string;
    order: { id: string; number: string; title: string | null };
  };
};

export function groupPartsByOrder<T extends PartSearchRow>(parts: T[]) {
  const map = new Map<
    string,
    { orderNumber: string; orderTitle: string | null; parts: T[] }
  >();

  for (const part of parts) {
    const key = part.product.order.number;
    const existing = map.get(key);
    if (existing) {
      existing.parts.push(part);
    } else {
      map.set(key, {
        orderNumber: part.product.order.number,
        orderTitle: part.product.order.title,
        parts: [part],
      });
    }
  }

  return [...map.values()].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
}

export function groupPartsByProduct<T extends PartSearchRow>(parts: T[]) {
  const map = new Map<
    string,
    {
      product: T["product"];
      orderTitle: string | null;
      parts: T[];
    }
  >();

  for (const part of parts) {
    const existing = map.get(part.product.id);
    if (existing) {
      existing.parts.push(part);
    } else {
      map.set(part.product.id, {
        product: part.product,
        orderTitle: part.product.order.title,
        parts: [part],
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    a.product.number.localeCompare(b.product.number, "ru", { numeric: true }),
  );
}
