export type EdgingSideId = "L1" | "L2" | "W1" | "W2";

export const EDGING_SIDE_LABELS: Record<EdgingSideId, string> = {
  L1: "низ",
  L2: "верх",
  W1: "лево",
  W2: "право",
};

export type ParsedEdgingSide = {
  id: EdgingSideId;
  label: string;
  /** Код кромки из Excel, напр. «1» или «1,1» */
  code: string;
};

export type ParsedEdging = {
  sides: Partial<Record<EdgingSideId, ParsedEdgingSide>>;
  /** Нераспознанные фрагменты (напр. S$1) */
  extra: string[];
  raw: string;
};

type EdgingToken = { axis: "L" | "W" | "S"; code: string };

function tokenizeEdging(raw: string): EdgingToken[] {
  const tokens: EdgingToken[] = [];
  let i = 0;

  while (i < raw.length) {
    const axis = raw[i];
    if (axis !== "L" && axis !== "W" && axis !== "S") {
      i += 1;
      continue;
    }
    if (raw[i + 1] !== "$") {
      i += 1;
      continue;
    }

    i += 2;
    let code = "";
    while (i < raw.length) {
      if (raw[i] === "$") {
        i += 1;
        break;
      }
      const ch = raw[i];
      if ((ch === "L" || ch === "W" || ch === "S") && raw[i + 1] === "$") break;
      code += ch;
      i += 1;
    }

    const trimmed = code.replace(/,$/, "").trim();
    if (trimmed) tokens.push({ axis, code: trimmed });
  }

  return tokens;
}

/** Разбор строки облицовки Базис: L$1$L$1$W$1$, L$1,1$L$1$W$1$ */
export function parseEdging(raw: string | null | undefined): ParsedEdging | null {
  const text = raw?.trim();
  if (!text) return null;

  const sides: Partial<Record<EdgingSideId, ParsedEdgingSide>> = {};
  const extra: string[] = [];
  let lIndex = 0;
  let wIndex = 0;

  for (const token of tokenizeEdging(text)) {
    if (token.axis === "L") {
      lIndex += 1;
      const id: EdgingSideId = lIndex === 1 ? "L1" : "L2";
      sides[id] = { id, label: EDGING_SIDE_LABELS[id], code: token.code };
      continue;
    }

    if (token.axis === "W") {
      wIndex += 1;
      const id: EdgingSideId = wIndex === 1 ? "W1" : "W2";
      sides[id] = { id, label: EDGING_SIDE_LABELS[id], code: token.code };
      continue;
    }

    extra.push(`${token.axis}$${token.code}`);
  }

  if (Object.keys(sides).length === 0 && extra.length === 0) return null;

  return { sides, extra, raw: text };
}

export function formatEdgingCode(side: ParsedEdgingSide): string {
  return `${side.id} · ${side.label} · кромка ${side.code}`;
}
