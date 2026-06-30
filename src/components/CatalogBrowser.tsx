"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CATALOG_TYPE_LABELS,
  CATALOG_UNIT_LABELS,
} from "@/lib/constants";
import {
  formatCatalogDimension,
  formatCatalogPrice,
  primaryPriceLabel,
} from "@/lib/catalog-format";
import type { CatalogCategory, CatalogItem, CatalogItemType } from "@prisma/client";

type ItemWithCategory = CatalogItem & {
  category: Pick<CatalogCategory, "id" | "name" | "type">;
};

type CategoryWithCount = CatalogCategory & { _count: { items: number } };

export function CatalogBrowser({
  items,
  categories,
  total,
  page,
  pages,
  currentCategoryId,
  currentType,
  query,
}: {
  items: ItemWithCategory[];
  categories: CategoryWithCount[];
  total: number;
  page: number;
  pages: number;
  currentCategoryId?: string;
  currentType?: CatalogItemType;
  query?: string;
}) {
  const router = useRouter();

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = {
      category: currentCategoryId,
      type: currentType,
      q: query,
      page: String(page),
      ...params,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "1") sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const q = String(fd.get("q") ?? "").trim();
          router.push(buildUrl({ q: q || undefined, page: "1" }));
        }}
      >
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Поиск по названию, коду…"
          className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-black"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-bold"
        >
          Найти
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildUrl({ category: undefined, type: undefined, page: "1" })}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
            !currentCategoryId && !currentType
              ? "bg-slate-900 text-white"
              : "bg-white border border-slate-200 text-black"
          }`}
        >
          Все ({total})
        </Link>
        {(Object.keys(CATALOG_TYPE_LABELS) as CatalogItemType[]).map((type) => (
          <Link
            key={type}
            href={buildUrl({ type, category: undefined, page: "1" })}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              currentType === type && !currentCategoryId
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-black"
            }`}
          >
            {CATALOG_TYPE_LABELS[type]}
          </Link>
        ))}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl({ category: cat.id, type: undefined, page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                currentCategoryId === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-50 text-indigo-900 border border-indigo-100"
              }`}
            >
              {cat.name} ({cat._count.items})
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          Позиций не найдено. Загрузите прайс-лист Excel через импорт выше.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-bold text-black">Название</th>
                <th className="px-4 py-3 font-bold text-black">Категория</th>
                <th className="px-4 py-3 font-bold text-black">Размер листа</th>
                <th className="px-4 py-3 font-bold text-black text-right">Лист</th>
                <th className="px-4 py-3 font-bold text-black text-right">Себес</th>
                <th className="px-4 py-3 font-bold text-black text-right">Клиенту</th>
                <th className="px-4 py-3 font-bold text-black">Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const labels = primaryPriceLabel(item.type, item.unit);
                const size =
                  item.heightM && item.widthM
                    ? `${formatCatalogDimension(item.heightM)} × ${formatCatalogDimension(item.widthM)} м`
                    : "—";

                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-black">{item.name}</div>
                      {item.subcategory && (
                        <div className="text-xs font-medium text-slate-500">{item.subcategory}</div>
                      )}
                      {item.code && (
                        <div className="text-xs font-medium text-slate-500">Код: {item.code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-black">{item.category.name}</td>
                    <td className="px-4 py-3 font-medium text-black">
                      {size}
                      {item.sheetAreaSqm ? (
                        <div className="text-xs text-slate-500">
                          {formatCatalogDimension(item.sheetAreaSqm)} м²
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-black" title={labels.plate}>
                      {formatCatalogPrice(item.platePrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-black" title={labels.cost}>
                      {formatCatalogPrice(item.costPrice)}
                      {item.costPrice && item.unit !== "SHEET" ? (
                        <div className="text-xs text-slate-500">
                          {CATALOG_UNIT_LABELS[item.unit]}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-black" title={labels.client}>
                      {formatCatalogPrice(item.clientPrice)}
                      {item.clientPrice && item.unit !== "SHEET" ? (
                        <div className="text-xs text-slate-500">
                          {CATALOG_UNIT_LABELS[item.unit]}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 font-bold hover:underline"
                        >
                          →
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
            >
              ← Назад
            </Link>
          )}
          <span className="text-sm font-medium text-black">
            Стр. {page} из {pages}
          </span>
          {page < pages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
            >
              Вперёд →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
