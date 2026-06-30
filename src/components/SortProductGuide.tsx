"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPartSortHint } from "@/lib/assembly-guide";
import { formatModuleLabel, resolvePartModule } from "@/lib/module";
import { matchesPositionQuery } from "@/lib/part-search";
import { WorkflowPartList, type WorkflowPartItem } from "./WorkflowPartList";
import { PartSearchField } from "./PartSearchField";
import type { PartStatus } from "@prisma/client";

type GuideDocument = {
  id: string;
  filename: string;
  fileUrl: string;
  type: string;
};

type GuidePart = WorkflowPartItem & {
  material: string | null;
  sectionOrder: number | null;
};

function AssemblyPdfViewer({ document }: { document: GuideDocument }) {
  return (
    <section className="w-full -mx-4 sm:mx-0">
      <div className="flex flex-col w-full overflow-hidden border-y sm:border border-slate-200 sm:rounded-2xl bg-slate-50 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-white border-b border-slate-200">
          <p className="font-bold text-black text-sm sm:text-base">Сборочный чертёж</p>
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-xs sm:text-sm font-bold shrink-0 min-h-[40px] inline-flex items-center"
          >
            Открыть PDF
          </a>
        </div>
        <div className="relative w-full bg-white">
          <iframe
            src={document.fileUrl}
            title={document.filename}
            className="w-full block border-0 bg-white
              min-h-[52dvh] h-[58dvh]
              sm:min-h-[58dvh] sm:h-[64dvh]
              md:min-h-[62dvh] md:h-[68dvh]
              lg:min-h-[680px] lg:h-[74dvh]
              xl:min-h-[720px] xl:h-[78dvh]
              2xl:h-[82dvh]"
          />
        </div>
      </div>
    </section>
  );
}

export function SortProductGuide({
  productId,
  productNumber,
  productName,
  orderNumber,
  parts: initialParts,
  initialQuery = "",
}: {
  productId: string;
  productNumber: string;
  productName: string;
  orderNumber: string;
  parts: GuidePart[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [document, setDocument] = useState<GuideDocument | null>(null);
  const [loadingDrawing, setLoadingDrawing] = useState(true);
  const [drawingError, setDrawingError] = useState<string | null>(null);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [parts, setParts] = useState(initialParts);

  useEffect(() => {
    let cancelled = false;
    setLoadingDrawing(true);
    fetch(`/api/products/${productId}/assembly-guide`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setDocument(data.document ?? null);
        setDrawingError(data.errors?.[0] ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDrawing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return parts;
    return parts.filter((p) => matchesPositionQuery(p, q));
  }, [parts, query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setActivePartId(null);
      return;
    }
    if (filtered.length === 1) {
      setActivePartId(filtered[0].id);
      return;
    }
    const match = parts.find((p) => matchesPositionQuery(p, q));
    setActivePartId(match?.id ?? null);
  }, [query, filtered, parts]);

  const activePart = activePartId ? parts.find((p) => p.id === activePartId) : null;
  const activeModule = activePart ? resolvePartModule(activePart) : null;

  const workflowParts: WorkflowPartItem[] = filtered.map((p) => ({
    ...p,
    product: {
      number: productNumber,
      name: productName,
      order: { number: orderNumber, title: null },
    },
  }));

  function handlePartUpdated(id: string) {
    setParts((prev) => prev.filter((p) => p.id !== id));
    if (activePartId === id) setActivePartId(null);
  }

  return (
    <div className="w-full max-w-none space-y-4 sm:space-y-5 lg:space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-4 sm:p-5 lg:p-6">
        <p className="text-xs font-bold uppercase tracking-wide opacity-90">Сортировка для изделия</p>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 leading-tight">
          {productNumber} — {productName}
        </p>
        <p className="text-sm sm:text-base font-medium mt-1 opacity-95">Заказ {orderNumber}</p>
      </div>

      {loadingDrawing && (
        <p className="text-sm font-medium text-black">Загрузка сборочного чертежа…</p>
      )}

      {!loadingDrawing && document && <AssemblyPdfViewer document={document} />}

      {!loadingDrawing && !document && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-black">
          {drawingError ??
            "Сборочный чертёж не загружен. Сортируйте по списку деталей ниже — менеджер может прикрепить PDF на странице заказа."}
        </div>
      )}

      <PartSearchField
        value={query}
        onChange={setQuery}
        hint="Сканируйте Поз. — система покажет модуль и подсветит деталь в списке ниже."
        placeholder="Поз. — код детали"
      />

      {activePart && activeModule && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-4 sm:p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wide opacity-90">Модуль на чертеже</p>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1 leading-tight">
            {formatModuleLabel(activeModule)}
          </p>
          <p className="text-sm sm:text-base font-medium mt-2 opacity-95">{formatPartSortHint(activePart)}</p>
        </div>
      )}

      {activePart && !activeModule && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-black">
          {formatPartSortHint(activePart)}
        </div>
      )}

      {query.trim() && filtered.length === 0 && (
        <p className="font-medium text-black text-center py-2">
          Нет деталей с Поз. «{query.trim()}»
        </p>
      )}

      <WorkflowPartList
        parts={workflowParts}
        stage="sort"
        actionLabel="✓ Отсортировано"
        nextStatus={"SORTED" as PartStatus}
        hideContext
        groupByModule={!query.trim()}
        onPartUpdated={handlePartUpdated}
      />
    </div>
  );
}
