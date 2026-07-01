"use client";

import { useEffect, useRef, useState } from "react";
import { formatCatalogPrice } from "@/lib/catalog-format";

type PriceField = "platePrice" | "costPrice" | "clientPrice";

export function CatalogEditablePrice({
  itemId,
  field,
  value,
  label,
  bold,
  onSaved,
}: {
  itemId: string;
  field: PriceField;
  value: number | null;
  label?: string;
  bold?: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(value != null ? String(value).replace(".", ",") : "");
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: draft.trim() === "" ? null : draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      setEditing(false);
      onSaved();
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="min-w-[88px]">
        <input
          ref={inputRef}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => void save()}
          className="w-full rounded border border-indigo-400 px-2 py-1 text-right text-sm font-medium text-black"
        />
        {error && <div className="text-xs text-red-600 mt-0.5">{error}</div>}
      </div>
    );
  }

  return (
    <button
      type="button"
      title={label ? `${label} — нажмите для изменения` : "Изменить цену"}
      onClick={startEdit}
      className={`text-right w-full hover:bg-indigo-50 rounded px-1 py-0.5 transition-colors ${
        bold ? "font-bold text-black" : "font-medium text-black"
      }`}
    >
      {formatCatalogPrice(value)}
    </button>
  );
}
