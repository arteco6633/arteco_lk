import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import {
  applyMarkup,
  buildCatalogItemWhere,
  plateToSqmPrice,
  type MarkupMode,
  type MarkupTarget,
} from "@/lib/catalog-pricing";
import type { CatalogItemType, Prisma } from "@prisma/client";

const BATCH = 100;

export async function POST(request: Request) {
  try {
    const session = await requireSessionFromDb();
    if (!canAccess(session.role, ["ADMIN", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const body = await request.json();
    const categoryId = body.categoryId ? String(body.categoryId) : undefined;
    const type = body.type as CatalogItemType | undefined;
    const q = body.q ? String(body.q).trim() : undefined;
    const target = body.target as MarkupTarget;
    const mode = body.mode as MarkupMode;
    const value = Number(body.value);
    const recalculateSqm = Boolean(body.recalculateSqm);
    const recalculateClient = Boolean(body.recalculateClient);
    const clientMarkupPercent =
      body.clientMarkupPercent != null ? Number(body.clientMarkupPercent) : 0;

    if (!["platePrice", "costPrice", "clientPrice"].includes(target)) {
      return NextResponse.json({ error: "Некорректное поле цены" }, { status: 400 });
    }
    if (!["percent", "fixed"].includes(mode)) {
      return NextResponse.json({ error: "Режим: percent или fixed" }, { status: 400 });
    }
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: "Укажите значение наценки" }, { status: 400 });
    }

    const where = buildCatalogItemWhere({ categoryId, type, q });
    const items = await prisma.catalogItem.findMany({
      where,
      select: {
        id: true,
        platePrice: true,
        costPrice: true,
        clientPrice: true,
        sheetAreaSqm: true,
      },
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "Нет позиций для изменения" }, { status: 400 });
    }

    const updates: Array<{ id: string; data: Prisma.CatalogItemUpdateInput }> = [];

    for (const item of items) {
      const current = item[target];
      if (current == null) continue;

      const next = applyMarkup(current, mode, value);
      if (next == null) continue;

      const data: Prisma.CatalogItemUpdateInput = { [target]: next };

      if (target === "platePrice" && recalculateSqm) {
        const sqm = plateToSqmPrice(next, item.sheetAreaSqm);
        if (sqm != null) data.costPrice = sqm;
      }

      if (recalculateClient) {
        const baseCost =
          typeof data.costPrice === "number"
            ? data.costPrice
            : target === "costPrice"
              ? next
              : item.costPrice;
        if (baseCost != null) {
          data.clientPrice =
            clientMarkupPercent !== 0
              ? applyMarkup(baseCost, "percent", clientMarkupPercent) ?? baseCost
              : target === "clientPrice"
                ? next
                : applyMarkup(item.clientPrice, mode, value) ?? item.clientPrice;
        }
      }

      updates.push({ id: item.id, data });
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "У выбранных позиций нет цены для изменения" },
        { status: 400 },
      );
    }

    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map(({ id, data }) => prisma.catalogItem.update({ where: { id }, data })),
      );
    }

    return NextResponse.json({
      ok: true,
      matched: items.length,
      updated: updates.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти" }, { status: 401 });
    }
    console.error("Catalog bulk markup failed:", error);
    return NextResponse.json({ error: "Ошибка массового изменения" }, { status: 500 });
  }
}
