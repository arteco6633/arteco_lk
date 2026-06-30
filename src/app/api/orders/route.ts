import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";

export async function GET() {
  await requireSessionFromDb();
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        include: {
          _count: { select: { parts: true } },
        },
      },
    },
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  await requireSessionFromDb();
  const body = await request.json();
  const number = String(body.number ?? "").trim();
  const title = String(body.title ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const products = Array.isArray(body.products) ? body.products : [];

  if (!number) {
    return NextResponse.json({ error: "Укажите № заказа" }, { status: 400 });
  }

  try {
    const order = await prisma.order.create({
      data: {
        number,
        title,
        notes,
        products: {
          create: products.map((p: { number: string; name: string }) => ({
            number: String(p.number).trim(),
            name: String(p.name).trim(),
          })),
        },
      },
      include: { products: true },
    });
    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Заказ с таким номером уже существует" }, { status: 400 });
  }
}
