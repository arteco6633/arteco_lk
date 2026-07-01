import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { CatalogImport } from "@/components/CatalogImport";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import type { CatalogItemType } from "@prisma/client";

type SearchParams = Promise<{
  category?: string;
  type?: string;
  q?: string;
  page?: string;
}>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) redirect("/login");

  const sp = await searchParams;
  const categoryId = sp.category;
  const type = sp.type as CatalogItemType | undefined;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page ?? "1"));
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = {
    active: true,
    ...(categoryId ? { categoryId } : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
            { subcategory: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total, totalAll, categories, importHistory] = await Promise.all([
    prisma.catalogItem.findMany({
      where,
      include: { category: { select: { id: true, name: true, type: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { subcategory: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    prisma.catalogItem.count({ where }),
    prisma.catalogItem.count({ where: { active: true } }),
    prisma.catalogCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.catalogImport.findMany({ orderBy: { createdAt: "desc" }, take: 3 }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Справочник материалов</h1>
        <p className="font-medium text-black mt-1">
          Прайс-листы, фурнитура и прочие позиции для расчётов и закупки
        </p>
      </div>

      <CatalogImport />

      {importHistory.length > 0 && (
        <div className="text-sm font-medium text-slate-600">
          Последний импорт:{" "}
          {importHistory[0].filename} — {importHistory[0].itemCount} поз. (
          {new Date(importHistory[0].createdAt).toLocaleString("ru-RU")})
        </div>
      )}

      <CatalogBrowser
        items={items}
        categories={categories}
        total={totalAll}
        filteredTotal={total}
        page={page}
        pages={pages}
        currentCategoryId={categoryId}
        currentType={type}
        query={q}
      />
    </div>
  );
}
