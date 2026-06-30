import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { filterPartsByPosition } from "@/lib/part-search";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const user = await requireSessionFromDb();
    if (!canAccess(user.role, ["ADMIN", "CONTRACTOR", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q.length) {
      return NextResponse.json({ parts: [], query: q });
    }

    const orderId = searchParams.get("orderId")?.trim();
    const productId = searchParams.get("productId")?.trim();

    if (!orderId && !productId) {
      return NextResponse.json(
        { error: "Укажите orderId или productId" },
        { status: 400 },
      );
    }

    const candidates = await prisma.part.findMany({
      where: {
        status: "CREATED",
        ...(productId ? { productId } : {}),
        ...(orderId && !productId ? { product: { orderId } } : {}),
      },
      include: {
        product: {
          include: { order: true },
        },
      },
      orderBy: [
        { sectionOrder: "asc" },
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
    console.error("Receipt part search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка поиска" },
      { status: 500 },
    );
  }
}
