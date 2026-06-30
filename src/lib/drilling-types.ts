export type DrillingHole = {
  index: number;
  diameter: number;
  depth?: number;
  x: number;
  y: number;
  holeType: "through" | "face" | "unknown";
};

export type DetailPageDrilling = {
  pageNumber: number;
  partLabel?: string;
  panelWidth?: number;
  panelHeight?: number;
  summary: string;
  holes: DrillingHole[];
  ocrPreview?: string;
};

export type DetailPdfDrillingResult = {
  pageCount: number;
  pages: DetailPageDrilling[];
  errors: string[];
};

/** Подбор страницы деталировки по размерам детали */
export function matchDetailPage(
  pages: DetailPageDrilling[],
  dimensions?: string | null,
): DetailPageDrilling | undefined {
  if (!dimensions) return pages[0];
  const nums = [...dimensions.matchAll(/(\d{3,4})/g)].map((m) => Number(m[1]));
  if (nums.length < 2) return pages[0];

  const [a, b] = nums;
  const w = Math.min(a, b);
  const h = Math.max(a, b);

  let best: DetailPageDrilling | undefined;
  let bestScore = Infinity;

  for (const page of pages) {
    if (!page.panelWidth || !page.panelHeight) continue;
    const pw = Math.min(page.panelWidth, page.panelHeight);
    const ph = Math.max(page.panelWidth, page.panelHeight);
    const score = Math.abs(pw - w) + Math.abs(ph - h);
    if (score < bestScore) {
      bestScore = score;
      best = page;
    }
  }

  return bestScore <= 80 ? best : pages[0];
}
