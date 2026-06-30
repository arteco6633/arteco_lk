"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProductInput = { number: string; name: string };

export function NewOrderForm() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<ProductInput[]>([
    { number: "1", name: "" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateProduct(index: number, field: keyof ProductInput, value: string) {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addProduct() {
    setProducts((prev) => [...prev, { number: String(prev.length + 1), name: "" }]);
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number,
        title,
        notes,
        products: products.filter((p) => p.number.trim() && p.name.trim()),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Ошибка создания заказа");
      return;
    }

    router.push(`/orders/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-lg">Основное</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">№ заказа *</label>
            <input
              required
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="2025-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Название / объект</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Кухня ул. Ленина"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Комментарий</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 min-h-[80px]"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Изделия</h2>
          <button
            type="button"
            onClick={addProduct}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium"
          >
            + Изделие
          </button>
        </div>

        {products.map((product, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[120px_1fr_auto] items-end">
            <div>
              <label className="block text-sm font-medium mb-1">№ изделия</label>
              <input
                required
                value={product.number}
                onChange={(e) => updateProduct(index, "number", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Название</label>
              <input
                required
                value={product.name}
                onChange={(e) => updateProduct(index, "name", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Кухня / шкаф / тумба"
              />
            </div>
            {products.length > 1 && (
              <button
                type="button"
                onClick={() => removeProduct(index)}
                className="rounded-lg text-red-600 px-3 py-3 text-sm"
              >
                Удалить
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 text-white px-6 py-3 font-medium disabled:opacity-60"
      >
        {loading ? "Создание..." : "Создать заказ"}
      </button>
    </form>
  );
}
