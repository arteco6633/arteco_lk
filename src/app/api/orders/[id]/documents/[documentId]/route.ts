import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const user = await requireSessionFromDb();
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Доступ только менеджеру" }, { status: 403 });
    }

    const { id: orderId, documentId } = await params;

    const document = await prisma.document.findFirst({
      where: { id: documentId, orderId },
    });

    if (!document) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    await deleteFile(document.filepath, document.storageProvider);
    await prisma.document.delete({ where: { id: documentId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
    }
    console.error("Order document delete error:", error);
    return NextResponse.json({ error: "Не удалось удалить файл" }, { status: 500 });
  }
}
