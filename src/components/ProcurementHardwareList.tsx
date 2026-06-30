"use client";

import { useState } from "react";
import { sortHardwareItems } from "@/lib/specification-groups";

export type ProcurementHardwareItem = {
  id: string;
  specNumber: number | null;
  code: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  purchased: boolean;
  purchasedAt: string | null;
};

function HardwareTable({
  items,
  loadingId,
  onToggle,
}: {
  items: ProcurementHardwareItem[];
  loadingId: string | null;
  onToggle: (id: string, purchased: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left font-bold text-black border-b">
            <th className="py-2 pr-3">№</th>
            <th className="py-2 pr-3">Артикул</th>
            <th className="py-2 pr-3">Наименование</th>
            <th className="py-2 pr-3">Кол-во</th>
            <th className="py-2 pr-3">Ед.</th>
            <th className="py-2">Статус</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={`border-b border-slate-100 ${item.purchased ? "bg-emerald-50/60" : ""}`}
            >
              <td className="py-2.5 pr-3 font-medium text-black">{item.specNumber ?? "—"}</td>
              <td className="py-2.5 pr-3 font-medium text-black">{item.code ?? "—"}</td>
              <td className="py-2.5 pr-3 font-medium text-black">{item.name}</td>
              <td className="py-2.5 pr-3 font-medium text-black">{item.quantity}</td>
              <td className="py-2.5 pr-3 font-medium text-black">{item.unit ?? "—"}</td>
              <td className="py-2.5">
                <button
                  type="button"
                  disabled={loadingId === item.id}
                  onClick={() => onToggle(item.id, !item.purchased)}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold min-h-[36px] disabled:opacity-60 ${
                    item.purchased
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {loadingId === item.id
                    ? "..."
                    : item.purchased
                      ? "✓ Закуплено"
                      : "Закупить"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProcurementProductCard({
  productNumber,
  productName,
  hardware,
  onUpdated,
}: {
  productNumber: string;
  productName: string;
  hardware: ProcurementHardwareItem[];
  onUpdated?: () => void;
}) {
  const [items, setItems] = useState(hardware);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const sorted = sortHardwareItems(items);
  const pending = sorted.filter((i) => !i.purchased);
  const purchasedCount = sorted.length - pending.length;

  async function toggleItem(id: string, purchased: boolean) {
    setLoadingId(id);
    const res = await fetch("/api/hardware", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hardwareId: id, purchased }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                purchased: updated.purchased,
                purchasedAt: updated.purchasedAt,
              }
            : item,
        ),
      );
      onUpdated?.();
    }
    setLoadingId(null);
  }

  async function purchaseAll() {
    const ids = pending.map((i) => i.id);
    if (ids.length === 0) return;
    setBulkLoading(true);
    const res = await fetch("/api/hardware", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hardwareIds: ids, purchased: true }),
    });
    if (res.ok) {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, purchased: true, purchasedAt: now } : item,
        ),
      );
      onUpdated?.();
    }
    setBulkLoading(false);
  }

  return (
    <div className="rounded-2xl border border-indigo-200 overflow-hidden bg-white">
      <div className="bg-indigo-50 px-4 sm:px-5 py-3 border-b border-indigo-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-bold text-black">
            Изделие {productNumber} — {productName}
          </h3>
          <p className="text-sm font-medium text-black mt-0.5">
            {sorted.length} позиций · закуплено {purchasedCount} / {sorted.length}
          </p>
        </div>
        {pending.length > 0 && (
          <button
            type="button"
            disabled={bulkLoading}
            onClick={purchaseAll}
            className="rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 shrink-0"
          >
            {bulkLoading ? "Сохранение..." : `Закупить всё (${pending.length})`}
          </button>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <HardwareTable items={sorted} loadingId={loadingId} onToggle={toggleItem} />
      </div>
    </div>
  );
}
