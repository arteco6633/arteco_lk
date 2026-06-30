"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { DrillHoleViewer } from "./DrillHoleViewer";
import type { DetailPageDrilling } from "@/lib/drilling-types";
import { matchDetailPage } from "@/lib/drilling-types";
import type { PartStatus } from "@prisma/client";

type DetailDoc = {
  id: string;
  filename: string;
  filepath: string;
};

type PartItem = {
  id: string;
  name: string;
  code: string | null;
  dimensions: string | null;
  quantity: number;
  material: string | null;
  status: PartStatus;
  product: {
    id: string;
    number: string;
    name: string;
    order: { number: string; title: string | null };
    documents: DetailDoc[];
  };
};

type ProductGroup = {
  key: string;
  orderNumber: string;
  productNumber: string;
  productName: string;
  documents: DetailDoc[];
  parts: PartItem[];
};

function groupByProduct(parts: PartItem[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();

  for (const part of parts) {
    const key = part.product.id;
    if (!map.has(key)) {
      map.set(key, {
        key,
        orderNumber: part.product.order.number,
        productNumber: part.product.number,
        productName: part.product.name,
        documents: part.product.documents,
        parts: [],
      });
    }
    map.get(key)!.parts.push(part);
  }

  return Array.from(map.values());
}

function DetailViewer({ documents }: { documents: DetailDoc[] }) {
  const [activeId, setActiveId] = useState(documents[0]?.id ?? "");

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-black">
        Деталировка не загружена. Попросите менеджера прикрепить PDF к изделию.
      </div>
    );
  }

  const active = documents.find((d) => d.id === activeId) ?? documents[0];
  const fileUrl = `/api/files/${active.filepath}`;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-white border-b border-slate-200">
        <p className="font-bold text-black text-sm">Деталировка: {active.filename}</p>
        <div className="flex flex-wrap gap-2">
          {documents.length > 1 &&
            documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveId(doc.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  doc.id === active.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-black hover:bg-slate-200"
                }`}
              >
                {doc.filename}
              </button>
            ))}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold"
          >
            Открыть PDF
          </a>
        </div>
      </div>
      <iframe
        src={fileUrl}
        title={active.filename}
        className="w-full h-[min(85vh,800px)] bg-white"
      />
    </div>
  );
}

function PartDrillingGuide({
  drilling,
  partName,
}: {
  drilling: DetailPageDrilling | null;
  partName: string;
}) {
  if (!drilling) return null;

  return <DrillHoleViewer drilling={drilling} partName={partName} />;
}

function GroupDrillingProvider({
  productId,
  children,
}: {
  productId: string;
  children: (ctx: {
    loading: boolean;
    error: string | null;
    match: (dimensions: string | null) => DetailPageDrilling | null;
  }) => React.ReactNode;
}) {
  const [pages, setPages] = useState<DetailPageDrilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${productId}/drilling?all=1`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Не удалось загрузить присадку");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPages(data.pages ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const match = (dimensions: string | null) => {
    if (pages.length === 0) return null;
    return matchDetailPage(pages, dimensions) ?? pages[0];
  };

  return <>{children({ loading, error, match })}</>;
}

export function DrillPartList({ parts }: { parts: PartItem[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const groups = groupByProduct(parts);

  async function completePart(partId: string, photo: File) {
    setLoadingId(partId);
    const formData = new FormData();
    formData.append("status", "DRILLED");
    formData.append("photo", photo);
    await fetch(`/api/parts/${partId}/status`, { method: "POST", body: formData });
    setLoadingId(null);
    window.location.reload();
  }

  if (parts.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
        Нет деталей на присадке
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-black">
              Изделие {group.productNumber} — {group.productName}
            </h2>
            <p className="text-sm font-medium text-black">Заказ {group.orderNumber}</p>
          </div>

          <DetailViewer documents={group.documents} />

          <GroupDrillingProvider productId={group.key}>
            {({ loading, error, match }) => (
              <>
                {loading && group.documents.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-black">
                    Распознаём отверстия из деталировки… (это может занять минуту)
                  </div>
                )}
                {error && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-black">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-bold text-black">Детали к присадке</h3>
                  {group.parts.map((part) => (
                    <div
                      key={part.id}
                      className="rounded-xl border border-slate-100 overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-black">{part.name}</span>
                            <StatusBadge status={part.status} />
                          </div>
                          <p className="text-sm font-medium text-black">
                            {part.code && <>Код: {part.code} · </>}
                            {part.dimensions && <>Размер: {part.dimensions} · </>}
                            Кол-во: {part.quantity}
                            {part.material && <> · {part.material}</>}
                          </p>
                        </div>
                        <label className="cursor-pointer rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold text-center hover:bg-slate-800 shrink-0 min-w-[200px]">
                          {loadingId === part.id ? "Сохранение..." : "📷 Фото + выполнено"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) completePart(part.id, file);
                            }}
                          />
                        </label>
                      </div>

                      {group.documents.length > 0 && !loading && !error && (
                        <div className="px-4 pb-4">
                          <PartDrillingGuide
                            drilling={match(part.dimensions)}
                            partName={part.name}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </GroupDrillingProvider>
        </div>
      ))}
    </div>
  );
}
