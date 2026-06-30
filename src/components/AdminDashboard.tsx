"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { PartStatus } from "@prisma/client";
import type { DashboardData } from "@/lib/dashboard";
import { ALL_STATUSES } from "@/lib/dashboard";

const REFRESH_MS = 5000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STAGE_CONFIG: Record<
  PartStatus,
  {
    stage: string;
    href?: string;
    cardClass: string;
    barClass: string;
    labelClass: string;
  }
> = {
  CREATED: {
    stage: "Ожидают приёмки",
    href: "/workflow/receipt",
    cardClass: "bg-slate-100 border-slate-300",
    barClass: "bg-slate-500",
    labelClass: "text-slate-600",
  },
  RECEIVED: {
    stage: "Приёмка",
    href: "/workflow/receipt",
    cardClass: "bg-blue-50 border-blue-200",
    barClass: "bg-blue-500",
    labelClass: "text-blue-700",
  },
  SORTED: {
    stage: "Сортировка",
    href: "/workflow/sort",
    cardClass: "bg-indigo-50 border-indigo-200",
    barClass: "bg-indigo-500",
    labelClass: "text-indigo-700",
  },
  DRILLED: {
    stage: "Присадка",
    href: "/workflow/drill",
    cardClass: "bg-amber-50 border-amber-200",
    barClass: "bg-amber-500",
    labelClass: "text-amber-800",
  },
  QC_PASSED: {
    stage: "ОКК",
    href: "/workflow/qc",
    cardClass: "bg-green-50 border-green-200",
    barClass: "bg-green-500",
    labelClass: "text-green-700",
  },
  QC_FAILED: {
    stage: "ОКК брак",
    href: "/workflow/qc",
    cardClass: "bg-red-50 border-red-200",
    barClass: "bg-red-500",
    labelClass: "text-red-700",
  },
  PACKED: {
    stage: "Упаковка",
    href: "/workflow/pack",
    cardClass: "bg-emerald-50 border-emerald-200",
    barClass: "bg-emerald-600",
    labelClass: "text-emerald-700",
  },
};

function StageOverviewCard({
  status,
  count,
  total,
}: {
  status: PartStatus;
  count: number;
  total: number;
}) {
  const config = STAGE_CONFIG[status];
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  const inner = (
    <>
      <p className={`text-xs font-bold uppercase tracking-wide ${config.labelClass}`}>
        {config.stage}
      </p>
      <p className="text-sm font-medium text-slate-700 mt-0.5 leading-tight">
        {STATUS_LABELS[status]}
      </p>
      <p className="text-3xl sm:text-4xl font-bold text-black mt-2 tabular-nums">{count}</p>
      {total > 0 && (
        <>
          <div className="h-1.5 rounded-full bg-white/70 overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${config.barClass}`}
              style={{ width: `${Math.max(percent, count > 0 ? 6 : 0)}%` }}
            />
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1.5">{percent}%</p>
        </>
      )}
    </>
  );

  const className = `rounded-2xl border p-4 shadow-sm transition-all ${config.cardClass} ${
    config.href ? "hover:shadow-md hover:scale-[1.01]" : ""
  }`;

  if (config.href) {
    return (
      <Link href={config.href} className={`block ${className}`}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 sm:p-10 text-center">
      <p className="font-bold text-black text-lg mb-1">{title}</p>
      <p className="text-sm font-medium text-slate-600 max-w-md mx-auto">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex mt-5 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-bold hover:bg-slate-800"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Ошибка загрузки");
      }
      const json: DashboardData = await res.json();
      setData(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-sm">
        <p className="font-medium text-slate-600">Загрузка дашборда…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
        <p className="font-medium text-red-800 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg bg-red-800 text-white px-4 py-2 text-sm font-bold"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isEmpty = data.totalParts === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <p className="text-sm font-medium text-slate-600">
            Обновлено {formatTime(data.updatedAt)} · каждые 5 сек
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-black hover:bg-slate-50 disabled:opacity-50 self-start"
        >
          {refreshing ? "Обновление…" : "Обновить"}
        </button>
      </div>

      {isEmpty && (
        <EmptyPanel
          title="Производство ещё не запущено"
          description={
            data.totalOrders > 0
              ? `В системе ${data.totalOrders} заказ(ов), но детали ещё не импортированы. Создайте заказ, загрузите Excel или PDF.`
              : "Создайте первый заказ, импортируйте детали из Excel и загрузите PDF-документы — здесь появится прогресс по этапам."
          }
          action={{ href: data.totalOrders > 0 ? "/orders" : "/orders/new", label: data.totalOrders > 0 ? "Перейти к заказам" : "+ Создать заказ" }}
        />
      )}

      <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-black">Детали по этапам</h2>
            <p className="text-sm font-medium text-slate-500">
              Сколько деталей на каждом участке производства
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 px-4 py-2 shrink-0">
            <p className="text-xs font-medium text-slate-300">Всего деталей</p>
            <p className="text-2xl font-bold text-white tabular-nums">{data.totalParts}</p>
          </div>
        </div>

        {isEmpty ? (
          <p className="text-sm font-medium text-slate-500 mb-4">
            Этапы появятся после импорта деталей в заказ.
          </p>
        ) : null}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {ALL_STATUSES.map((status) => (
            <StageOverviewCard
              key={status}
              status={status}
              count={data.totals[status]}
              total={data.totalParts}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-black">Заказы в работе</h2>
          <Link href="/orders" className="text-sm font-bold text-blue-700 hover:underline">
            Все заказы →
          </Link>
        </div>
        {data.activeOrders.length === 0 ? (
          <EmptyPanel
            title="Нет заказов с деталями"
            description={
              data.ordersWithoutParts > 0
                ? `${data.ordersWithoutParts} заказ(ов) без деталей — откройте заказ и импортируйте Excel или PDF.`
                : "Создайте заказ и добавьте детали, чтобы отслеживать прогресс здесь."
            }
            action={{ href: "/orders/new", label: "+ Новый заказ" }}
          />
        ) : (
          <div className="space-y-3">
            {data.activeOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:border-slate-300 hover:shadow transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-black text-lg">Заказ {order.number}</h3>
                    {order.title && (
                      <p className="text-sm font-medium text-slate-600">{order.title}</p>
                    )}
                  </div>
                  <div className="text-sm font-bold text-black tabular-nums">
                    {order.productCount} изд. · {order.totalParts} дет. · {order.progressPercent}%
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                  {ALL_STATUSES.map((status) => {
                    const count = order.byStatus[status];
                    if (count === 0) return null;
                    const width = (count / order.totalParts) * 100;
                    const colorMap: Record<PartStatus, string> = {
                      CREATED: "bg-slate-400",
                      RECEIVED: "bg-blue-500",
                      SORTED: "bg-indigo-500",
                      DRILLED: "bg-amber-500",
                      QC_PASSED: "bg-green-500",
                      QC_FAILED: "bg-red-500",
                      PACKED: "bg-emerald-600",
                    };
                    return (
                      <div
                        key={status}
                        className={`h-full ${colorMap[status]} transition-all duration-500`}
                        style={{ width: `${width}%` }}
                        title={`${STATUS_LABELS[status]}: ${count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {ALL_STATUSES.filter((s) => order.byStatus[s] > 0).map((status) => (
                    <span
                      key={status}
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}
                    >
                      {STATUS_LABELS[status]}: {order.byStatus[status]}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <h2 className="text-lg font-bold text-black px-5 pt-5 pb-3">Последние действия</h2>
        {data.recentActivity.length === 0 ? (
          <p className="px-5 pb-5 text-sm font-medium text-slate-500">
            История появится, когда сотрудники начнут работу на этапах приёмки, сортировки и далее.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 hover:bg-slate-50"
              >
                <span className="text-xs font-medium text-slate-500 shrink-0 sm:w-28 tabular-nums">
                  {formatTime(item.createdAt)}
                </span>
                <span className="text-sm font-bold text-black shrink-0">{item.userName}</span>
                <span className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">
                  {item.partName} · заказ {item.orderNumber} · изд. {item.productNumber}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 self-start ${
                    item.toStatus ? STATUS_COLORS[item.toStatus] : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.action}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
