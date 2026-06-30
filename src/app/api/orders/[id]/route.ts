import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { deleteUploads } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSessionFromDb();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          parts: { orderBy: { name: "asc" } },
          documents: true,
          hardware: true,
          _count: { select: { parts: true } },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionFromDb();
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Доступ только менеджеру" }, { status: 403 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            documents: { select: { filepath: true } },
            parts: { select: { drillPhotoPath: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    const files: string[] = [];
    for (const product of order.products) {
      for (const doc of product.documents) files.push(doc.filepath);
      for (const part of product.parts) {
        if (part.drillPhotoPath) files.push(part.drillPhotoPath);
      }
    }

    await deleteUploads(files);
    await prisma.order.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
    }
    console.error("Order delete error:", error);
    return NextResponse.json({ error: "Не удалось удалить заказ" }, { status: 500 });
  }
}
