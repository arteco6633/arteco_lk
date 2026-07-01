"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItemType } from "@prisma/client";

export function CatalogBulkMarkup({
  categoryId,
  type,
  query,
  filteredTotal,
}: {
  categoryId?: string;
  type?: CatalogItemType;
  query?: string;
  filteredTotal: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [target, setTarget] = useState<"platePrice" | "costPrice" | "clientPrice">("platePrice");
  const [recalculateSqm, setRecalculateSqm] = useState(true);
  const [recalculateClient, setRecalculateClient] = useState(false);
  const [clientMarkupPercent, setClientMarkupPercent] = useState("200");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const scopeLabel = [
    categoryId ? "категория" : null,
    type ? "тип" : null,
    query ? `поиск «${query}»` : null,
  ]
    .filter(Boolean)
    .join(", ");

  async function apply() {
    const num = Number(value.replace(",", "."));
    if (!Number.isFinite(num)) {
      setMessage("Укажите число");
      return;
    }

    const clientPct = Number(clientMarkupPercent.replace(",", "."));
    const label =
      target === "platePrice"
        ? "цену листа"
        : target === "costPrice"
          ? "себес за м²"
          : "цену клиенту";

    if (
      !confirm(
        `Применить наценку ${mode === "percent" ? `${num}%` : `${num} ₽`} к ${label} для ${filteredTotal} поз.?`,
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/catalog/bulk-markup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          type,
          q: query,
          target,
          mode,
          value: num,
          recalculateSqm: target === "platePrice" && recalculateSqm,
          recalculateClient,
          clientMarkupPercent: recalculateClient ? clientPct : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Ошибка");
        return;
      }
      setMessage(`Обновлено ${data.updated} из ${data.matched} позиций`);
      router.refresh();
    } catch {
      setMessage("Не удалось применить наценку");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="font-bold text-black">Массовая наценка</h2>
          <p className="text-sm font-medium text-slate-600 mt-0.5">
            {filteredTotal} поз. в выборке{scopeLabel ? ` (${scopeLabel})` : ""}
          </p>
        </div>
        <span className="text-sm font-bold text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-black">
              Поле
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as typeof target)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="platePrice">Себестоимость за лист</option>
                <option value="costPrice">Себес за м²</option>
                <option value="clientPrice">Цена клиенту за м²</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-black">
              Наценка
              <div className="mt-1 flex gap-2">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="percent">%</option>
                  <option value="fixed">₽</option>
                </select>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  placeholder={mode === "percent" ? "10" : "500"}
                />
              </div>
            </label>
          </div>

          {target === "platePrice" && (
            <label className="flex items-center gap-2 text-sm font-medium text-black cursor-pointer">
              <input
                type="checkbox"
                checked={recalculateSqm}
                onChange={(e) => setRecalculateSqm(e.target.checked)}
              />
              Пересчитать себес за м² от новой цены листа
            </label>
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-black cursor-pointer">
            <input
              type="checkbox"
              checked={recalculateClient}
              onChange={(e) => setRecalculateClient(e.target.checked)}
            />
            Пересчитать цену клиенту
          </label>

          {recalculateClient && (
            <label className="block text-sm font-medium text-black">
              Наценка клиенту к себесу, %
              <input
                value={clientMarkupPercent}
                onChange={(e) => setClientMarkupPercent(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2"
                placeholder="200"
              />
            </label>
          )}

          <button
            type="button"
            disabled={loading || filteredTotal === 0}
            onClick={() => void apply()}
            className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {loading ? "Применяем…" : "Применить наценку"}
          </button>

          {message && (
            <p
              className={`text-sm font-medium ${message.startsWith("Обновлено") ? "text-green-700" : "text-red-700"}`}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
