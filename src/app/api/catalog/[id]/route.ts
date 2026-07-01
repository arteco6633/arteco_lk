import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { parseCatalogPriceInput } from "@/lib/catalog-pricing";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSessionFromDb();
    if (!canAccess(session.role, ["ADMIN", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updates: {
      platePrice?: number | null;
      costPrice?: number | null;
      clientPrice?: number | null;
    } = {};

    for (const field of ["platePrice", "costPrice", "clientPrice"] as const) {
      if (!(field in body)) continue;
      const raw = body[field];
      if (raw === null || raw === "") {
        updates[field] = null;
        continue;
      }
      if (typeof raw === "number") {
        if (!Number.isFinite(raw) || raw < 0) {
          return NextResponse.json({ error: `Некорректное значение ${field}` }, { status: 400 });
        }
        updates[field] = Math.round(raw * 100) / 100;
        continue;
      }
      const parsed = parseCatalogPriceInput(String(raw));
      if (parsed === undefined) {
        return NextResponse.json({ error: `Некорректное значение ${field}` }, { status: 400 });
      }
      updates[field] = parsed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }

    const item = await prisma.catalogItem.update({
      where: { id },
      data: updates,
      include: { category: { select: { id: true, name: true, type: true } } },
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти" }, { status: 401 });
    }
    console.error("Catalog item update failed:", error);
    return NextResponse.json({ error: "Не удалось сохранить" }, { status: 500 });
  }
}
