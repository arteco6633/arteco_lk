"use client";

import { useEffect, useMemo, useState } from "react";
import { AssemblyPdfViewer } from "@/components/AssemblyPdfViewer";
import { PartDrillingLoader } from "@/components/PartDrillingLoader";
import { PartSearchField } from "@/components/PartSearchField";
import { WorkflowPartList, type WorkflowPartItem } from "@/components/WorkflowPartList";
import { formatPartSortHint } from "@/lib/assembly-guide";
import { formatModuleLabel, resolvePartModule } from "@/lib/module";
import { matchesPositionQuery } from "@/lib/part-search";
import type { PartStatus } from "@prisma/client";

type GuidePart = WorkflowPartItem & {
  material: string | null;
  sectionOrder: number | null;
};

type GuideDocument = {
  id: string;
  filename: string;
  fileUrl: string;
  type: string;
};

export function DrillProductGuide({
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
    const found = parts.find((p) => matchesPositionQuery(p, q));
    setActivePartId(found?.id ?? null);
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
      <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-white p-4 sm:p-5 lg:p-6">
        <p className="text-xs font-bold uppercase tracking-wide opacity-90">Присадка для изделия</p>
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
            "Сборочный чертёж не загружен. Работайте по списку деталей — менеджер может прикрепить PDF на странице заказа."}
        </div>
      )}

      <PartSearchField
        value={query}
        onChange={setQuery}
        hint="Сканируйте Поз. — система покажет модуль и схему присадки для детали."
        placeholder="Поз. — код детали"
      />

      {activePart && activeModule && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-4 sm:p-5 shadow-lg space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide opacity-90">Модуль на чертеже</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1 leading-tight">
              {formatModuleLabel(activeModule)}
            </p>
            <p className="text-sm sm:text-base font-medium mt-2 opacity-95">
              {formatPartSortHint(activePart)}
            </p>
          </div>
          <PartDrillingLoader
            productId={productId}
            dimensions={activePart.dimensions}
            partName={activePart.name}
            autoLoad
          />
        </div>
      )}

      {activePart && !activeModule && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-black space-y-3">
          <p>{formatPartSortHint(activePart)}</p>
          <PartDrillingLoader
            productId={productId}
            dimensions={activePart.dimensions}
            partName={activePart.name}
            autoLoad
          />
        </div>
      )}

      {query.trim() && filtered.length === 0 && (
        <p className="font-medium text-black text-center py-2">
          Нет деталей с Поз. «{query.trim()}»
        </p>
      )}

      <WorkflowPartList
        parts={workflowParts}
        stage="drill"
        actionLabel="📷 Фото + выполнено"
        nextStatus={"DRILLED" as PartStatus}
        requirePhoto
        hideContext
        groupByModule={!query.trim()}
        onPartUpdated={handlePartUpdated}
        renderPartFooter={(part) => (
          <PartDrillingLoader
            productId={productId}
            dimensions={part.dimensions}
            partName={part.name}
            autoLoad={part.id === activePartId}
          />
        )}
      />
    </div>
  );
}
