import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";

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
  });

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

  const result = await prisma.hardwareItem.updateMany({
    where: { id: { in: ids } },
    data: {
      purchased,
      purchasedAt: purchased ? new Date() : null,
    },
  });

  return NextResponse.json({ updated: result.count });
}
