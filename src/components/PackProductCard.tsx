"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { fileApiUrl } from "@/lib/file-url";
import type { DocumentType, PartStatus, StorageProvider } from "@prisma/client";

type HardwareItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  packed: boolean;
};

type Part = {
  id: string;
  name: string;
  code: string | null;
  dimensions: string | null;
  quantity: number;
  status: PartStatus;
};

type Document = {
  id: string;
  type: DocumentType;
  filename: string;
  filepath: string;
  storageProvider?: StorageProvider;
};

type ProductPack = {
  id: string;
  number: string;
  name: string;
  order: { number: string };
  parts: Part[];
  hardware: HardwareItem[];
  documents: Document[];
};

function PrintLink({
  href,
  label,
  filename,
}: {
  href: string;
  label: string;
  filename: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100"
    >
      <div>
        <p className="font-bold text-black">{label}</p>
        <p className="text-sm font-medium text-black">{filename}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-amber-500 text-white px-3 py-2 text-sm font-bold">
        Распечатать
      </span>
    </a>
  );
}

export function PackProductCard({ product }: { product: ProductPack }) {
  const [loadingPart, setLoadingPart] = useState<string | null>(null);
  const [loadingHw, setLoadingHw] = useState<string | null>(null);

  async function packPart(partId: string) {
    setLoadingPart(partId);
    const formData = new FormData();
    formData.append("status", "PACKED");
    await fetch(`/api/parts/${partId}/status`, { method: "POST", body: formData });
    setLoadingPart(null);
    window.location.reload();
  }

  async function toggleHardware(id: string, packed: boolean) {
    setLoadingHw(id);
    await fetch("/api/hardware", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hardwareId: id, packed }),
    });
    setLoadingHw(null);
    window.location.reload();
  }

  const partsToPack = product.parts.filter((p) => p.status === "QC_PASSED");
  const packedParts = product.parts.filter((p) => p.status === "PACKED").length;
  const totalParts = product.parts.length;

  const assemblyDrawings = product.documents.filter((d) => d.type === "ASSEMBLY_DRAWING");
  const labels = product.documents.filter((d) => d.type === "LABEL");

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-black">
            Изделие {product.number} — {product.name}
          </h2>
          <p className="text-sm font-medium text-black">Заказ {product.order.number}</p>
        </div>
        <p className="text-sm font-bold text-black">
          Упаковано деталей: {packedParts} / {totalParts}
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
        <h3 className="font-bold text-black">Документы для печати и вкладывания в упаковку</h3>
        {assemblyDrawings.length === 0 && labels.length === 0 ? (
          <p className="text-sm font-medium text-black">
            Загрузите сборочный чертёж и бирку в карточке заказа (менеджер)
          </p>
        ) : (
          <div className="space-y-2">
            {assemblyDrawings.map((doc) => (
              <PrintLink
                key={doc.id}
                href={fileApiUrl(doc.filepath, doc.storageProvider ?? "LOCAL")}
                label="Сборочный чертёж — распечатать и приложить"
                filename={doc.filename}
              />
            ))}
            {labels.map((doc) => (
              <PrintLink
                key={doc.id}
                href={fileApiUrl(doc.filepath, doc.storageProvider ?? "LOCAL")}
                label="Бирка — распечатать и приклеить на упаковку"
                filename={doc.filename}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-bold text-black mb-2">Детали к упаковке</h3>
          <div className="space-y-2">
            {partsToPack.length === 0 ? (
              <p className="text-sm font-medium text-black">Все детали упакованы ✓</p>
            ) : (
              partsToPack.map((part) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <div>
                    <p className="font-bold text-sm text-black">{part.name}</p>
                    <p className="text-xs font-medium text-black">
                      {part.dimensions && `${part.dimensions} · `}×{part.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={part.status} />
                    <button
                      type="button"
                      disabled={loadingPart === part.id}
                      onClick={() => packPart(part.id)}
                      className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold"
                    >
                      {loadingPart === part.id ? "..." : "Упаковано"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-black mb-2">Фурнитура в коробку</h3>
          {product.hardware.length === 0 ? (
            <p className="text-sm font-medium text-black">Фурнитура не добавлена (импорт из Excel)</p>
          ) : (
            <div className="space-y-2">
              {product.hardware.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 cursor-pointer"
                >
                  <span className="text-sm font-medium text-black">
                    {item.name} — {item.quantity}
                    {item.unit ? ` ${item.unit}` : " шт."}
                  </span>
                  <input
                    type="checkbox"
                    checked={item.packed}
                    disabled={loadingHw === item.id}
                    onChange={(e) => toggleHardware(item.id, e.target.checked)}
                    className="h-5 w-5"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
