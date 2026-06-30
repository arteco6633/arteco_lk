"use client";

import { useState } from "react";
import { uploadFileDirect } from "@/lib/direct-upload-client";

type ImportDetail = {
  name: string;
  status: "created" | "skipped";
  message?: string;
};

export function PdfPartsImport({
  productId,
  productNumber,
  productName,
}: {
  productId: string;
  productNumber: string;
  productName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<ImportDetail[]>([]);
  const [previewLines, setPreviewLines] = useState<string[]>([]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage("");
    setDetails([]);
    setPreviewLines([]);

    try {
      const formData = new FormData();
      formData.append("savePdf", "true");

      const direct = await uploadFileDirect(file, `documents/${productId}`);
      if (direct) {
        formData.append("filename", direct.filename);
        formData.append("filepath", direct.filepath);
        formData.append("storageProvider", direct.storageProvider);
      } else {
        formData.append("file", file);
      }

      const res = await fetch(`/api/products/${productId}/import-parts-pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        const err =
          res.status === 413
            ? "PDF слишком большой. Добавьте SUPABASE_SERVICE_ROLE_KEY на Vercel."
            : (data.error ?? "Ошибка импорта");
        setMessage(err);
        if (data.previewLines) setPreviewLines(data.previewLines);
        return;
      }

      setDetails(data.details ?? []);
      setMessage(
        `Импортировано ${data.created} деталей из PDF (стр. ${data.pageNumber}, ${data.method === "ocr" ? "OCR" : "текст"}) для изделия №${productNumber} «${productName}»`,
      );

      if (data.created > 0) {
        setTimeout(() => window.location.reload(), 2500);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <div>
        <h4 className="font-bold text-black">Импорт деталей из PDF</h4>
        <p className="text-sm font-medium text-black mt-1">
          Загрузите PDF от технолога (Базис/K3 и др.) — система прочитает таблицу{" "}
          <strong>«Спецификация на панели»</strong> со <strong>2-й страницы</strong> и добавит
          детали в изделие №{productNumber}. Работает и с PDF-картинками (OCR). PDF также
          сохранится как деталировка.
        </p>
      </div>

      <label className="inline-flex cursor-pointer rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-bold">
        {loading ? "Разбор PDF (до 25 сек)..." : "Загрузить PDF со списком деталей"}
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleImport}
        />
      </label>

      {message && <p className="text-sm font-bold text-black">{message}</p>}

      {previewLines.length > 0 && details.length === 0 && (
        <div className="rounded-lg bg-white border border-slate-200 p-3">
          <p className="text-xs font-bold text-black mb-2">Что удалось прочитать со 2-й страницы:</p>
          <pre className="text-xs font-medium text-black whitespace-pre-wrap max-h-40 overflow-auto">
            {previewLines.join("\n")}
          </pre>
        </div>
      )}

      {details.length > 0 && (
        <ul className="text-sm font-medium text-black space-y-1">
          {details.map((d) => (
            <li key={d.name}>
              {d.status === "created" ? "✓" : "—"} {d.name}
              {d.message && <span className="text-black/70"> ({d.message})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
