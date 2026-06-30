import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { syncOrderStatus } from "@/lib/orders";

export async function POST(request: Request) {
  const user = await requireSessionFromDb();
  if (
    !canAccess(user.role, ["ADMIN", "MANAGER", "PACKER"])
  ) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const body = await request.json();
  const hardwareId = String(body.hardwareId ?? "");
  if (!hardwareId) {
    return NextResponse.json({ error: "Не указана позиция фурнитуры" }, { status: 400 });
  }

  const data: { packed?: boolean; purchased?: boolean; purchasedAt?: Date | null } = {};

  if (body.packed !== undefined) {
    data.packed = Boolean(body.packed);
  }

  if (body.purchased !== undefined) {
    const purchased = Boolean(body.purchased);
    data.purchased = purchased;
    data.purchasedAt = purchased ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
  }

  const item = await prisma.hardwareItem.update({
    where: { id: hardwareId },
    data,
    include: { product: { select: { orderId: true } } },
  });

  await syncOrderStatus(item.product.orderId);

  return NextResponse.json(item);
}

export async function PATCH(request: Request) {
  const user = await requireSessionFromDb();
  if (!canAccess(user.role, ["ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const body = await request.json();
  const ids = Array.isArray(body.hardwareIds) ? body.hardwareIds.map(String) : [];
  const purchased = Boolean(body.purchased);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Не указаны позиции" }, { status: 400 });
  }

  const items = await prisma.hardwareItem.findMany({
    where: { id: { in: ids } },
    select: { product: { select: { orderId: true } } },
  });

  const result = await prisma.hardwareItem.updateMany({
    where: { id: { in: ids } },
    data: {
      purchased,
      purchasedAt: purchased ? new Date() : null,
    },
  });

  const orderIds = [...new Set(items.map((i) => i.product.orderId))];
  await Promise.all(orderIds.map((orderId) => syncOrderStatus(orderId)));

  return NextResponse.json({ updated: result.count });
}
