"use client";

import { useState } from "react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { fileApiUrl } from "@/lib/file-url";
import type { DocumentType, StorageProvider } from "@prisma/client";

type DocItem = {
  id: string;
  type: DocumentType;
  filename: string;
  filepath: string;
  storageProvider?: StorageProvider;
};

type Props =
  | { scope: "product"; parentId: string; documents: DocItem[] }
  | { scope: "order"; parentId: string; documents: DocItem[] };

export function DocumentList({ scope, parentId, documents }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (documents.length === 0) return null;

  const deleteUrl =
    scope === "order"
      ? `/api/orders/${parentId}/documents`
      : `/api/products/${parentId}/documents`;

  async function handleDelete(doc: DocItem) {
    const label =
      DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type;
    const confirmed = window.confirm(`Удалить файл «${label}: ${doc.filename}»?`);
    if (!confirmed) return;

    setLoadingId(doc.id);
    setError("");

    const res = await fetch(`${deleteUrl}/${doc.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      window.location.reload();
      return;
    }

    setLoadingId(null);
    setError(data.error ?? "Не удалось удалить файл");
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-1 rounded-lg bg-slate-100 pl-3 pr-1 py-1"
          >
            <a
              href={fileApiUrl(doc.filepath, doc.storageProvider ?? "LOCAL")}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-black hover:underline"
            >
              {DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ??
                doc.type}
              : {doc.filename}
            </a>
            <button
              type="button"
              onClick={() => handleDelete(doc)}
              disabled={loadingId === doc.id}
              title="Удалить файл"
              className="rounded-md px-2 py-1 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {loadingId === doc.id ? "…" : "×"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
