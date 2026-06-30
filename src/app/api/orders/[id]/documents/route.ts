import { NextResponse } from "next/server";
import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { saveFile } from "@/lib/storage";

const ALLOWED_TYPES = new Set<string>(Object.values(DocumentType));

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSessionFromDb();
    const { id: orderId } = await params;
    const formData = await request.formData();
    const typeRaw = String(formData.get("type") ?? "").trim();
    const file = formData.get("file");

    if (!ALLOWED_TYPES.has(typeRaw)) {
      return NextResponse.json(
        { error: `Неверный тип документа: ${typeRaw || "(пусто)"}` },
        { status: 400 },
      );
    }

    const type = typeRaw as DocumentType;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    const saved = await saveFile(file, `orders/${orderId}`);
    const document = await prisma.document.create({
      data: {
        orderId,
        type,
        filename: saved.filename,
        filepath: saved.filepath,
        storageProvider: saved.storageProvider,
      },
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Ошибка типа документа. Перезапустите сервер." },
        { status: 500 },
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
    }
    console.error("Order document upload error:", error);
    return NextResponse.json({ error: "Не удалось загрузить файл" }, { status: 500 });
  }
}
