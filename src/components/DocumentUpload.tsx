"use client";

import { useState } from "react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { uploadFileDirect } from "@/lib/direct-upload-client";
import type { DocumentType } from "@prisma/client";

const DOC_TYPES: DocumentType[] = ["ASSEMBLY_DRAWING", "PART_DETAIL", "LABEL"];

type Props =
  | { scope: "product"; productId: string }
  | { scope: "order"; orderId: string };

export function DocumentUpload(props: Props) {
  const [type, setType] = useState<DocumentType>("ASSEMBLY_DRAWING");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const uploadUrl =
    props.scope === "order"
      ? `/api/orders/${props.orderId}/documents`
      : `/api/products/${props.productId}/documents`;

  const subdir =
    props.scope === "order"
      ? `orders/${props.orderId}`
      : `documents/${props.productId}`;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      const direct = await uploadFileDirect(file, subdir);
      const formData = new FormData();
      formData.append("type", type);

      if (direct) {
        formData.append("filename", direct.filename);
        formData.append("filepath", direct.filepath);
        formData.append("storageProvider", direct.storageProvider);
      } else {
        formData.append("file", file);
      }

      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setMessage("Файл загружен");
        window.location.reload();
      } else {
        const err =
          res.status === 413
            ? "Файл слишком большой. Добавьте SUPABASE_SERVICE_ROLE_KEY на Vercel."
            : (data.error ?? "Ошибка загрузки");
        setMessage(err);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as DocumentType)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-black"
      >
        {DOC_TYPES.map((t) => (
          <option key={t} value={t}>
            {DOCUMENT_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <label className="cursor-pointer rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
        {loading ? "Загрузка..." : "Загрузить PDF"}
        <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} />
      </label>
      {message && <span className="text-sm font-medium text-red-700">{message}</span>}
    </div>
  );
}
