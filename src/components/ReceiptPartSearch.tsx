"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { groupPartsByProductAndSection } from "@/lib/specification-groups";
import { matchesPositionQuery, type PartSearchRow } from "@/lib/part-search";
import { WorkflowPartList } from "./WorkflowPartList";
import { PartSearchField } from "./PartSearchField";
import type { PartStatus } from "@prisma/client";

type ProductPart = {
  id: string;
  specNumber: number | null;
  name: string;
  code: string | null;
  length: string | null;
  width: string | null;
  dimensions: string | null;
  quantity: number;
  material: string | null;
  sectionOrder: number | null;
  status: PartStatus;
  product: {
    number: string;
    name: string;
    order: { number: string; title: string | null };
  };
};

function SearchField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <PartSearchField
      value={value}
      onChange={onChange}
      hint={hint}
      placeholder="Поз. — код детали или штрихкод"
    />
  );
}

/** Поиск деталей на приёмке внутри заказа */
export function ReceiptOrderPartSearch({
  orderId,
}: {
  orderId: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [parts, setParts] = useState<PartSearchRow[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debounced.length) {
      setParts([]);
      setSearched(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(
      `/api/workflow/receipt/search?q=${encodeURIComponent(debounced)}&orderId=${orderId}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setParts(data.parts ?? []);
        setSearched(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, orderId]);

  async function markReceived(partId: string) {
    setLoadingId(partId);
    const formData = new FormData();
    formData.append("status", "RECEIVED");
    await fetch(`/api/parts/${partId}/status`, { method: "POST", body: formData });
    setParts((prev) => prev.filter((p) => p.id !== partId));
    setLoadingId(null);
  }

  const grouped = useMemo(() => groupPartsByProductAndSection(parts), [parts]);
  const isActive = debounced.length >= 1;

  return (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        hint="В этом заказе. Только по Поз. (код детали)."
      />

      {loading && <p className="font-medium text-black text-center py-4 mb-6">Поиск...</p>}

      {!loading && isActive && searched && parts.length === 0 && (
        <p className="font-medium text-black text-center py-4 mb-6">
          В заказе нет деталей на приёмке по запросу «{debounced}»
        </p>
      )}

      {!loading && parts.length > 0 && (
        <div className="space-y-6 mb-8">
          <p className="text-sm font-bold text-black">Найдено: {parts.length}</p>
          {grouped.map(({ product, sections }) => (
            <div key={product.id} className="space-y-4">
              <h2 className="text-lg font-bold text-black">
                <Link
                  href={`/workflow/receipt/${orderId}/${product.id}`}
                  className="text-blue-700 hover:underline"
                >
                  Изделие {product.number} — {product.name}
                </Link>
              </h2>
              {sections.map((section) => (
                <div
                  key={`${product.id}-${section.sectionOrder}-${section.material}`}
                  className="rounded-xl border border-slate-200 overflow-hidden"
                >
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                    <h3 className="font-bold text-black">{section.title}</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {section.parts.map((part) => (
                      <div
                        key={part.id}
                        className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-sm font-bold">
                              Поз. {part.code ?? "—"}
                            </span>
                            {part.specNumber != null && (
                              <span className="text-sm font-bold text-black">№ {part.specNumber}</span>
                            )}
                          </div>
                          <p className="font-bold text-black">{part.name}</p>
                          <p className="text-sm font-medium text-black mt-1">
                            {(part.length && part.width
                              ? `${part.length}×${part.width}`
                              : part.dimensions) && (
                              <>
                                Размер:{" "}
                                <span className="font-bold">
                                  {part.length && part.width
                                    ? `${part.length}×${part.width}`
                                    : part.dimensions}
                                </span>
                                {" · "}
                              </>
                            )}
                            Кол-во: {part.quantity}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={loadingId === part.id}
                          onClick={() => markReceived(part.id)}
                          className="shrink-0 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-60"
                        >
                          {loadingId === part.id ? "Сохранение..." : "✓ Принято"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Поиск и список деталей на приёмке внутри изделия */
export function ReceiptProductPartList({ parts }: { parts: ProductPart[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return parts;
    return parts.filter((p) => matchesPositionQuery(p, q));
  }, [parts, query]);

  const isActive = query.trim().length >= 1;

  return (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        hint="В этом изделии. Только по Поз. (код детали)."
      />

      {isActive && filtered.length === 0 && (
        <p className="font-medium text-black text-center py-4 mb-4">
          В изделии нет деталей по запросу «{query.trim()}»
        </p>
      )}

      {isActive && filtered.length > 0 && (
        <p className="text-sm font-bold text-black mb-3">Найдено: {filtered.length}</p>
      )}

      <WorkflowPartList
        parts={isActive ? filtered : parts}
        stage="receipt"
        actionLabel="✓ Принято"
        nextStatus="RECEIVED"
        hideContext
        groupBySection={!isActive}
      />
    </>
  );
}
