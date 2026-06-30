import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import type { CatalogItemType } from "@prisma/client";

export async function GET(request: Request) {
  const session = await requireSessionFromDb().catch(() => null);
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const type = searchParams.get("type") as CatalogItemType | null;
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(20, Number(searchParams.get("limit") ?? "50")));
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

  const [items, total, categories] = await Promise.all([
    prisma.catalogItem.findMany({
      where,
      include: { category: { select: { id: true, name: true, type: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { subcategory: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    prisma.catalogItem.count({ where }),
    prisma.catalogCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
    categories,
  });
}
