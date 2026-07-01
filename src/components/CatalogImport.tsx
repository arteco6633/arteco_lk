"use client";

import { useRef, useState, type DragEvent } from "react";
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

const EXCEL_ACCEPT =
  ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function CatalogImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  function pickFileFromList(files: FileList | null | undefined) {
    const file = files?.[0];
    if (!file) return;
    void handleFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    pickFileFromList(e.dataTransfer.files);
  }

  async function handleFile(file: File) {
    if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      setMessage("Нужен файл Excel (.xlsx, .xls, .xlsm)");
      setResult(null);
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);

    const formData = new FormData();
    formData.append("mode", mode);

    try {
      // Небольшие Excel — напрямую на сервер (быстрее). Крупные — через Storage.
      const useDirectStorage = file.size > 4 * 1024 * 1024;
      let direct = null;

      if (useDirectStorage) {
        try {
          direct = await uploadFileDirect(file, "catalog-imports");
        } catch {
          // fallback — отправим файл напрямую на API
        }
      }

      if (direct) {
        formData.append("filepath", direct.filepath);
        formData.append("filename", direct.filename);
        formData.append("storageProvider", direct.storageProvider);
      } else {
        formData.append("file", file);
      }

      const res = await fetch("/api/catalog/import", { method: "POST", body: formData });
      const data = (await res.json()) as ImportResult & { error?: string };

      if (!res.ok) {
        setMessage(
          res.status === 413
            ? "Файл слишком большой. Обновите страницу — загрузка должна идти через Storage."
            : (data.error ?? "Ошибка импорта"),
        );
        return;
      }

      setResult(data);
      setMessage(
        `Импортировано: ${data.createdCount ?? 0} новых, ${data.updatedCount ?? 0} обновлено` +
          (data.skipped ? `, пропущено строк: ${data.skipped}` : ""),
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить файл");
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

      {/* Прозрачный input поверх кнопки — надёжно открывает Finder в Safari */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400"
        }`}
      >
        <p className="text-sm font-medium text-slate-600 mb-3">
          Перетащите Excel сюда или нажмите кнопку
        </p>
        <label
          className={`relative inline-flex rounded-xl bg-slate-900 text-white text-sm font-bold shadow-sm ${
            loading ? "opacity-70 cursor-wait" : "hover:bg-slate-800 cursor-pointer"
          }`}
        >
          <span className="px-5 py-3 pointer-events-none select-none">
            {loading ? "Импорт… подождите" : "Выбрать файл Excel"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={EXCEL_ACCEPT}
            disabled={loading}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
            onChange={(e) => pickFileFromList(e.target.files)}
          />
        </label>
        <p className="text-xs font-medium text-slate-500 mt-2">
          .xlsx, .xls, .xlsm · большой прайс может грузиться 30–60 сек
        </p>
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
