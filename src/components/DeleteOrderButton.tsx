"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      `Удалить заказ «${orderNumber}»?\n\nБудут удалены все изделия, детали, документы и фото. Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      router.push("/orders");
      router.refresh();
      return;
    }

    setLoading(false);
    setError(data.error ?? "Не удалось удалить заказ");
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? "Удаление..." : "Удалить заказ"}
      </button>
      {error && <span className="text-sm font-medium text-red-700">{error}</span>}
    </div>
  );
}
