import { NextResponse } from "next/server";
import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { resolveUploadFromForm } from "@/lib/resolve-upload";

const ALLOWED_TYPES = new Set<string>(Object.values(DocumentType));

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSessionFromDb();
    const { id: productId } = await params;
    const formData = await request.formData();
    const typeRaw = String(formData.get("type") ?? "").trim();

    if (!ALLOWED_TYPES.has(typeRaw)) {
      return NextResponse.json(
        { error: `Неверный тип документа: ${typeRaw || "(пусто)"}` },
        { status: 400 },
      );
    }

    const type = typeRaw as DocumentType;
    const saved = await resolveUploadFromForm(formData, `documents/${productId}`);

    if (!saved) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Изделие не найдено" }, { status: 404 });
    }

    const document = await prisma.document.create({
      data: {
        productId,
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
        {
          error:
            "Ошибка типа документа. Перезапустите сервер: npm run dev (после обновления системы).",
        },
        { status: 500 },
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
    }
    console.error("Document upload error:", error);
    return NextResponse.json({ error: "Не удалось загрузить файл" }, { status: 500 });
  }
}
