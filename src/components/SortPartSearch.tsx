"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { groupPartsByProduct, type PartSearchRow } from "@/lib/part-search";
import { formatModuleLabel, resolvePartModule } from "@/lib/module";
import { PartSearchField } from "./PartSearchField";

function formatSize(part: PartSearchRow): string | null {
  if (part.length && part.width) return `${part.length}×${part.width}`;
  return part.dimensions;
}

function ModuleHighlight({ module, partName }: { module: string; partName: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 shadow-lg">
      <p className="text-xs font-bold uppercase tracking-wide opacity-90">Модуль на чертеже</p>
      <p className="text-3xl sm:text-4xl font-bold mt-1 leading-tight">{formatModuleLabel(module)}</p>
      <p className="text-sm font-medium mt-2 opacity-95">{partName}</p>
    </div>
  );
}

function ProductHighlight({
  productNumber,
  productName,
  orderNumber,
  orderTitle,
  partCount,
  href,
}: {
  productNumber: string;
  productName: string;
  orderNumber: string;
  orderTitle: string | null;
  partCount: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5 shadow-lg hover:from-indigo-700 hover:to-indigo-900 transition-colors"
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-90">Изделие</p>
      <p className="text-2xl sm:text-3xl font-bold mt-1 leading-tight">
        {productNumber} — {productName}
      </p>
      <p className="text-sm font-medium mt-2 opacity-95">
        Заказ {orderNumber}
        {orderTitle ? ` · ${orderTitle}` : ""}
      </p>
      {partCount > 1 && (
        <p className="text-sm font-medium mt-1 opacity-90">{partCount} детали с этой Поз.</p>
      )}
      <p className="text-xs font-bold mt-3 underline opacity-90">Открыть чертёж и сортировку →</p>
    </Link>
  );
}

/** Поиск по Поз. — сразу показывает изделие */
export function SortPartSearch() {
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

    fetch(`/api/workflow/sort/search?q=${encodeURIComponent(debounced)}`)
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
  }, [debounced]);

  async function markSorted(partId: string) {
    setLoadingId(partId);
    const formData = new FormData();
    formData.append("status", "SORTED");
    await fetch(`/api/parts/${partId}/status`, { method: "POST", body: formData });
    setParts((prev) => prev.filter((p) => p.id !== partId));
    setLoadingId(null);
  }

  const productGroups = groupPartsByProduct(parts);
  const isActive = debounced.length >= 1;
  const singleProduct = productGroups.length === 1;
  const singlePart = parts.length === 1;
  const singleModule =
    singlePart && resolvePartModule(parts[0]) ? resolvePartModule(parts[0])! : null;

  return (
    <>
      <PartSearchField
        value={query}
        onChange={setQuery}
        hint="Сканируйте или введите Поз. (код детали) — система покажет изделие и модуль на чертеже."
        placeholder="Поз. — код детали"
      />

      {loading && <p className="font-medium text-black text-center py-4 mb-6">Поиск...</p>}

      {!loading && isActive && searched && parts.length === 0 && (
        <p className="font-medium text-black text-center py-4 mb-6">
          Нет деталей на сортировке с Поз. «{debounced}»
        </p>
      )}

      {!loading && parts.length > 0 && (
        <div className="space-y-6 mb-8">
          {singleModule && (
            <ModuleHighlight module={singleModule} partName={parts[0].name} />
          )}

          {singleProduct && (
            <ProductHighlight
              productNumber={productGroups[0].product.number}
              productName={productGroups[0].product.name}
              orderNumber={productGroups[0].product.order.number}
              orderTitle={productGroups[0].orderTitle}
              partCount={productGroups[0].parts.length}
              href={`/workflow/sort/${productGroups[0].product.id}?poz=${encodeURIComponent(debounced)}`}
            />
          )}

          {!singleProduct && (
            <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Поз. «{debounced}» найдена в {productGroups.length} изделиях — выберите нужное:
            </p>
          )}

          {productGroups.map((group) => (
            <div key={group.product.id} className="space-y-3">
              {!singleProduct && (
                <ProductHighlight
                  productNumber={group.product.number}
                  productName={group.product.name}
                  orderNumber={group.product.order.number}
                  orderTitle={group.orderTitle}
                  partCount={group.parts.length}
                  href={`/workflow/sort/${group.product.id}?poz=${encodeURIComponent(debounced)}`}
                />
              )}

              <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
                {group.parts.map((part) => {
                  const size = formatSize(part);
                  const module = resolvePartModule(part);
                  return (
                    <div
                      key={part.id}
                      className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-sm font-bold">
                            Поз. {part.code ?? "—"}
                          </span>
                          {module && (
                            <span className="rounded-lg bg-emerald-700 text-white px-2.5 py-1 text-sm font-bold">
                              {formatModuleLabel(module)}
                            </span>
                          )}
                          {part.specNumber != null && (
                            <span className="text-sm font-bold text-black">№ {part.specNumber}</span>
                          )}
                        </div>
                        <p className="font-bold text-black">{part.name}</p>
                        {part.material && (
                          <p className="text-sm font-medium text-black">{part.material}</p>
                        )}
                        <p className="text-sm font-medium text-black mt-1">
                          {size && (
                            <>
                              Размер: <span className="font-bold">{size}</span> ·{" "}
                            </>
                          )}
                          Кол-во: {part.quantity}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={loadingId === part.id}
                        onClick={() => markSorted(part.id)}
                        className="shrink-0 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-60"
                      >
                        {loadingId === part.id ? "Сохранение..." : "✓ Отсортировано"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
