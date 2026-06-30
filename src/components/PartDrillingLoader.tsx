"use client";

import { useEffect, useState } from "react";
import { DrillHoleViewer } from "@/components/DrillHoleViewer";
import type { DetailPageDrilling } from "@/lib/drilling-types";

const drillCache = new Map<string, DetailPageDrilling>();

export function PartDrillingLoader({
  productId,
  dimensions,
  partName,
  autoLoad = false,
}: {
  productId: string;
  dimensions: string | null;
  partName: string;
  autoLoad?: boolean;
}) {
  const [open, setOpen] = useState(autoLoad);
  const [drilling, setDrilling] = useState<DetailPageDrilling | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpen(autoLoad);
  }, [autoLoad]);

  useEffect(() => {
    if (!open || !dimensions) return;

    const cacheKey = `${productId}:${dimensions}`;
    const cached = drillCache.get(cacheKey);
    if (cached) {
      setDrilling(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/products/${productId}/drilling?dimensions=${encodeURIComponent(dimensions)}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Не удалось загрузить схему");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const result = data.drilling as DetailPageDrilling | undefined;
        if (result) {
          drillCache.set(cacheKey, result);
          setDrilling(result);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, dimensions, productId]);

  if (!dimensions) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-sm font-bold text-amber-800 hover:underline"
      >
        Показать схему присадки
      </button>
    );
  }

  if (loading) {
    return (
      <p className="mt-2 text-sm font-medium text-black">Загрузка схемы присадки…</p>
    );
  }

  if (error) {
    return <p className="mt-2 text-sm font-medium text-red-700">{error}</p>;
  }

  if (!drilling) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <DrillHoleViewer drilling={drilling} partName={partName} />
    </div>
  );
}
