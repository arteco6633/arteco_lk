"use client";

import { useState } from "react";
import {
  parseHardwareExcel,
  parsePartsExcel,
  parseSpecificationExcel,
} from "@/lib/excel";

type ImportDetail = {
  row: number;
  name: string;
  productNumber: string;
  status: "created" | "not_found" | "skipped";
  target?: string;
  message?: string;
  kind?: "part" | "hardware";
};

export function ExcelImport({
  orderId,
  products,
}: {
  orderId: string;
  products: Array<{ number: string; name: string }>;
}) {
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<ImportDetail[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"split" | "bazis" | null>(null);

  const productList = products.map((p) => `№${p.number} — ${p.name}`).join(", ");

  async function downloadExport(format: "split" | "bazis") {
    setExporting(format);
    try {
      const res = await fetch(`/api/orders/${orderId}/export/excel?format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Ошибка выгрузки");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `spec_export_${format}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  async function importFile(file: File, type: "specification" | "parts" | "hardware") {
    setLoading(true);
    setMessage("");
    setDetails([]);
    setParseErrors([]);

    const buffer = await file.arrayBuffer();
    let payload: Record<string, unknown>;

    if (type === "specification") {
      const parsed = parseSpecificationExcel(buffer);
      payload = {
        orderId,
        type,
        parts: parsed.parts,
        hardware: parsed.hardware,
        skipped: parsed.skipped,
        errors: parsed.errors,
      };
    } else if (type === "hardware") {
      const parsed = parseHardwareExcel(buffer);
      payload = {
        orderId,
        type,
        rows: parsed.rows,
        skipped: parsed.skipped,
        errors: parsed.errors,
      };
    } else {
      const parsed = parsePartsExcel(buffer);
      payload = {
        orderId,
        type,
        rows: parsed.rows,
        skipped: parsed.skipped,
        errors: parsed.errors,
      };
    }

    const res = await fetch("/api/import/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: Record<string, unknown> = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      setMessage("Сервер вернул некорректный ответ. Перезапустите dev-сервер (npm run dev) и попробуйте снова.");
      setLoading(false);
      return;
    }
    setLoading(false);

    if (!res.ok) {
      const errText =
        res.status === 413
          ? "Файл слишком большой для сервера. Попробуйте обновить страницу — импорт должен идти через браузер."
          : typeof data.error === "string"
            ? data.error
            : "Ошибка импорта";
      setMessage(errText);
      return;
    }

    const details = (data.details as ImportDetail[] | undefined) ?? [];
    const errors = (data.errors as string[] | undefined) ?? [];
    setDetails(details);
    setParseErrors(errors);

    if (type === "specification") {
      const summary = `Импортировано: ${data.partsCreated ?? 0} деталей, ${data.hardwareCreated ?? 0} фурнитуры`;
      const extra: string[] = [];
      if ((data.notFound as number) > 0) extra.push(`${data.notFound} строк не привязаны к изделию`);
      if ((data.skipped as number) > 0) extra.push(`${data.skipped} строк пропущено парсером`);
      if (errors.length > 0) extra.push(`предупреждения: ${errors.length}`);
      setMessage([summary, ...extra].join(". "));
    } else {
      const label = type === "parts" ? "деталей" : "позиций фурнитуры";
      const summary = `Импортировано ${data.created} из ${data.total} ${label}`;
      const extra: string[] = [];
      if ((data.notFound as number) > 0) extra.push(`${data.notFound} не привязаны к изделию`);
      if ((data.skipped as number) > 0) extra.push(`${data.skipped} строк пропущено`);
      setMessage([summary, ...extra].join(". "));
    }

    if ((data.created as number) > 0) {
      setTimeout(() => window.location.reload(), 2500);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
      <h3 className="font-bold text-lg text-black">Импорт и выгрузка Excel</h3>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm font-medium text-black space-y-2">
        <p className="font-bold">Выгрузка спецификации</p>
        <p>
          Детали группируются по материалам, фурнитура — отдельно. Можно скачать файл для повторного
          импорта в систему.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => downloadExport("split")}
            className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {exporting === "split" ? "Выгрузка..." : "По материалам (разные листы)"}
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => downloadExport("bazis")}
            className="rounded-lg border border-emerald-700 text-emerald-900 px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {exporting === "bazis" ? "Выгрузка..." : "Формат Базис (один лист)"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm font-medium text-black space-y-2">
        <p className="font-bold">Формат спецификации Базис</p>
        <p>
          Поддерживается выгрузка как в Google Sheets: блоки по материалам («Спецификация на …») и
          блок фурнитуры. Также читаются файлы с отдельным листом на каждый материал.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-black">
          <li>Детали: №, Поз., Наименование, Длина, Ширина, Кол-во, Облицовка, Паз, Прямоуг.</li>
          <li>Материал берётся из заголовка секции</li>
          <li>Фурнитура: Артикул, Наименование, Кол-во</li>
          <li>Изделие — из строки «Изделие» в файле (или единственное изделие в заказе)</li>
        </ul>
        <p>
          Изделия в заказе: <strong>{productList || "нет изделий"}</strong>
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-black mb-2">
            Спецификация целиком — детали всех материалов + фурнитура
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-bold">
              {loading ? "Импорт..." : "Импорт спецификации"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importFile(file, "specification");
                }}
              />
            </label>
            <a
              href="/templates/specification-template.xlsx"
              download
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-black"
            >
              Скачать образец
            </a>
          </div>
        </div>

        <details className="text-sm">
          <summary className="font-bold text-black cursor-pointer">Простой формат (отдельно)</summary>
          <div className="mt-3 space-y-3 pl-1">
            <div>
              <p className="font-medium text-black mb-2">
                Только детали: № изделия, Название, Код, Размер, Количество, Материал
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium">
                  Импорт деталей
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importFile(file, "parts");
                    }}
                  />
                </label>
                <a
                  href="/templates/parts-template.xlsx"
                  download
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-black"
                >
                  Шаблон деталей
                </a>
              </div>
            </div>
            <div>
              <p className="font-medium text-black mb-2">
                Только фурнитура: № изделия, Название, Количество, Ед
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium">
                  Импорт фурнитуры
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importFile(file, "hardware");
                    }}
                  />
                </label>
                <a
                  href="/templates/hardware-template.xlsx"
                  download
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-black"
                >
                  Шаблон фурнитуры
                </a>
              </div>
            </div>
          </div>
        </details>
      </div>

      {message && <p className="text-sm font-bold text-black">{message}</p>}

      {parseErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-bold text-black mb-2">Предупреждения парсера ({parseErrors.length})</p>
          <ul className="list-disc pl-5 space-y-1 text-black max-h-40 overflow-y-auto">
            {parseErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {details.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left font-bold text-black">
                <th className="px-3 py-2">Строка</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Позиция</th>
                <th className="px-3 py-2">Куда попала</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={`${d.kind}-${d.row}-${d.name}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-black">{d.row}</td>
                  <td className="px-3 py-2 font-medium text-black">
                    {d.kind === "hardware" ? "Фурнитура" : "Деталь"}
                  </td>
                  <td className="px-3 py-2 font-medium text-black">{d.name}</td>
                  <td className="px-3 py-2 font-medium text-black">
                    {d.status === "created" ? (
                      <span className="text-green-800">✓ {d.target}</span>
                    ) : (
                      <span className="text-red-700">✗ {d.message}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
