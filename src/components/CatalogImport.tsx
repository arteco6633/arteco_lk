"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFileDirect } from "@/lib/direct-upload-client";

type ImportResult = {
  sheetCount?: number;
  itemCount?: number;
  createdCount?: number;
  updatedCount?: number;
  skipped?: number;
  errors?: string[];
  sheets?: Array<{ name: string; type: string; count: number }>;
};

export function CatalogImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setMessage("");
    setResult(null);

    const formData = new FormData();
    formData.append("mode", mode);

    const direct = await uploadFileDirect(file, "catalog-imports");
    if (direct) {
      formData.append("filepath", direct.filepath);
      formData.append("filename", direct.filename);
      formData.append("storageProvider", direct.storageProvider);
    } else {
      formData.append("file", file);
    }

    try {
      const res = await fetch("/api/catalog/import", { method: "POST", body: formData });
      const data = (await res.json()) as ImportResult & { error?: string };

      if (!res.ok) {
        setMessage(data.error ?? "Ошибка импорта");
        return;
      }

      setResult(data);
      setMessage(
        `Импортировано: ${data.createdCount ?? 0} новых, ${data.updatedCount ?? 0} обновлено` +
          (data.skipped ? `, пропущено строк: ${data.skipped}` : ""),
      );
      router.refresh();
    } catch {
      setMessage("Не удалось загрузить файл");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="font-bold text-black">Импорт из Excel</h2>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Каждый лист файла — отдельная категория (ЛДСП EGGER, МДФ и т.д.). Колонки: название,
          цена плиты, размеры, себестоимость, цена клиенту, ссылка.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm font-medium text-black">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="catalog-mode"
            checked={mode === "merge"}
            onChange={() => setMode("merge")}
          />
          Добавить / обновить
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="catalog-mode"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          Заменить позиции в категориях листов
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          disabled={loading}
          className="text-sm font-medium text-black file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {loading && <span className="text-sm font-medium text-slate-600">Импорт…</span>}
      </div>

      {message && (
        <p className={`text-sm font-medium ${result ? "text-green-700" : "text-red-700"}`}>
          {message}
        </p>
      )}

      {result?.sheets && result.sheets.length > 0 && (
        <div className="text-sm">
          <p className="font-bold text-black mb-2">Листы:</p>
          <ul className="space-y-1 font-medium text-slate-700">
            {result.sheets.map((s) => (
              <li key={s.name}>
                {s.name} — {s.count} поз.
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.errors && result.errors.length > 0 && (
        <div className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">
          <p className="font-bold mb-1">Предупреждения:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {result.errors.slice(0, 10).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
