import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { filterPartsByPosition } from "@/lib/part-search";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const user = await requireSessionFromDb();
    if (!canAccess(user.role, ["ADMIN", "SORTER", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q.length) {
      return NextResponse.json({ parts: [], query: q });
    }

    const candidates = await prisma.part.findMany({
      where: { status: "RECEIVED" },
      include: {
        product: {
          include: { order: true },
        },
      },
      orderBy: [
        { product: { order: { number: "asc" } } },
        { product: { number: "asc" } },
        { specNumber: "asc" },
        { name: "asc" },
      ],
      take: 500,
    });

    const parts = filterPartsByPosition(candidates, q).map((part) => ({
      id: part.id,
      specNumber: part.specNumber,
      name: part.name,
      code: part.code,
      length: part.length,
      width: part.width,
      dimensions: part.dimensions,
      quantity: part.quantity,
      material: part.material,
      module: part.module ?? null,
      sectionOrder: part.sectionOrder,
      status: part.status,
      product: {
        id: part.product.id,
        number: part.product.number,
        name: part.product.name,
        order: {
          id: part.product.order.id,
          number: part.product.order.number,
          title: part.product.order.title,
        },
      },
    }));

    return NextResponse.json({ parts, query: q });
  } catch (error) {
    console.error("Sort part search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка поиска" },
      { status: 500 },
    );
  }
}
