"use client";

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { groupPartsByMaterialSection } from "@/lib/specification-groups";
import { formatModuleLabel, groupPartsByModule, resolvePartModule } from "@/lib/module";
import type { PartStatus } from "@prisma/client";

export type WorkflowPartItem = {
  id: string;
  specNumber: number | null;
  name: string;
  code: string | null;
  module?: string | null;
  length: string | null;
  width: string | null;
  dimensions: string | null;
  quantity: number;
  material: string | null;
  sectionOrder: number | null;
  status: PartStatus;
  drillPhotoPath?: string | null;
  product: {
    number: string;
    name: string;
    order: { number: string; title: string | null };
  };
};

type Props = {
  parts: WorkflowPartItem[];
  actionLabel: string;
  nextStatus: PartStatus;
  stage: "receipt" | "sort" | "drill" | "qc" | "pack";
  requirePhoto?: boolean;
  allowReject?: boolean;
  rejectStatus?: PartStatus;
  hideContext?: boolean;
  groupBySection?: boolean;
  groupByModule?: boolean;
  onPartUpdated?: (partId: string) => void;
};

function formatSize(part: WorkflowPartItem): string | null {
  if (part.length && part.width) return `${part.length}×${part.width}`;
  if (part.dimensions) return part.dimensions;
  return part.length ?? part.width ?? null;
}

export function WorkflowPartList({
  parts,
  actionLabel,
  nextStatus,
  stage,
  requirePhoto = false,
  allowReject = false,
  rejectStatus = "QC_FAILED",
  hideContext = false,
  groupBySection = false,
  groupByModule = false,
  onPartUpdated,
}: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});

  async function updatePart(partId: string, status: PartStatus, photo?: File) {
    setLoadingId(partId);
    const formData = new FormData();
    formData.append("status", status);
    if (comment[partId]) formData.append("comment", comment[partId]);
    if (photo) formData.append("photo", photo);

    await fetch(`/api/parts/${partId}/status`, { method: "POST", body: formData });
    setLoadingId(null);

    if (onPartUpdated) {
      onPartUpdated(partId);
    } else {
      window.location.reload();
    }
  }

  function renderPartCard(part: WorkflowPartItem) {
    const size = formatSize(part);
    const module = resolvePartModule(part);

    return (
      <div key={part.id} className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-sm font-bold">
                Поз. {part.code ?? "—"}
              </span>
              {module && (
                <span className="rounded-lg bg-emerald-700 text-white px-2.5 py-1 text-sm font-bold">
                  {formatModuleLabel(module)}
                </span>
              )}
              {part.specNumber != null && (
                <span className="text-sm font-bold text-black">№ {part.specNumber}</span>
              )}
              <StatusBadge status={part.status} />
            </div>
            <h3 className="font-bold text-black">{part.name}</h3>
            {!hideContext && (
              <p className="text-sm font-medium text-black">
                Заказ {part.product.order.number} · Изделие {part.product.number} —{" "}
                {part.product.name}
              </p>
            )}
            <p className="text-sm font-medium text-black mt-1">
              {size && (
                <>
                  Размер: <span className="font-bold">{size}</span> ·{" "}
                </>
              )}
              Кол-во: {part.quantity}
            </p>
            {part.drillPhotoPath && (
              <a
                href={`/api/files/${part.drillPhotoPath}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-sm font-bold text-blue-700 underline"
              >
                Фото присадки
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-[220px]">
            {stage === "qc" && (
              <input
                type="text"
                placeholder="Комментарий при браке"
                value={comment[part.id] ?? ""}
                onChange={(e) => setComment({ ...comment, [part.id]: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-black"
              />
            )}

            {requirePhoto ? (
              <label className="cursor-pointer rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold text-center hover:bg-slate-800">
                {loadingId === part.id ? "Сохранение..." : actionLabel}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updatePart(part.id, nextStatus, file);
                  }}
                />
              </label>
            ) : (
              <button
                type="button"
                disabled={loadingId === part.id}
                onClick={() => updatePart(part.id, nextStatus)}
                className="rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingId === part.id ? "Сохранение..." : actionLabel}
              </button>
            )}

            {allowReject && (
              <button
                type="button"
                disabled={loadingId === part.id}
                onClick={() => updatePart(part.id, rejectStatus)}
                className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-bold hover:bg-red-100 disabled:opacity-60"
              >
                Не ОК
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
        Нет деталей на этом этапе
      </div>
    );
  }

  if (groupByModule) {
    const modules = groupPartsByModule(parts);

    return (
      <div className="space-y-6">
        {modules.map((section) => (
          <div
            key={section.module}
            className="rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200">
              <h3 className="font-bold text-black">{section.label}</h3>
              <p className="text-sm font-medium text-black mt-0.5">
                {section.parts.length} деталей · список как на чертеже
              </p>
            </div>
            <div className="p-3 space-y-3 bg-slate-50">
              {section.parts.map((part) => renderPartCard(part))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groupBySection) {
    const sections = groupPartsByMaterialSection(parts);

    return (
      <div className="space-y-6">
        {sections.map((section) => (
          <div
            key={`${section.sectionOrder}-${section.material}`}
            className="rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
              <h3 className="font-bold text-black">{section.title}</h3>
              <p className="text-sm font-medium text-black mt-0.5">
                {section.parts.length} деталей к приёмке
              </p>
            </div>
            <div className="p-3 space-y-3 bg-slate-50">
              {section.parts.map((part) => renderPartCard(part))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <div className="space-y-3">{parts.map((part) => renderPartCard(part))}</div>;
}
