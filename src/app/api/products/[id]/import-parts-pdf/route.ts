import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { parsePartsFromPdfPage2 } from "@/lib/pdf-parts";
import { readFileBuffer } from "@/lib/storage";
import { resolveUploadFromForm } from "@/lib/resolve-upload";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionFromDb();
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Доступ только менеджеру" }, { status: 403 });
    }

    const { id: productId } = await params;
    const formData = await request.formData();
    const savePdf = formData.get("savePdf") !== "false";

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { order: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Изделие не найдено" }, { status: 404 });
    }

    const saved = await resolveUploadFromForm(formData, `documents/${productId}`);
    if (!saved) {
      return NextResponse.json({ error: "Выберите PDF файл" }, { status: 400 });
    }

    if (!saved.filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Нужен файл PDF" }, { status: 400 });
    }

    const buffer = await readFileBuffer(saved.filepath, saved.storageProvider);
    const parsed = await parsePartsFromPdfPage2(buffer);

    if (parsed.parts.length === 0) {
      return NextResponse.json(
        {
          error: parsed.errors[0] ?? "Детали не найдены на 2-й странице",
          previewLines: parsed.previewLines,
          rawLineCount: parsed.rawLineCount,
        },
        { status: 400 },
      );
    }

    let created = 0;
    const details: Array<{ name: string; status: "created" | "skipped"; message?: string }> = [];

    for (const part of parsed.parts) {
      const existing = await prisma.part.findFirst({
        where: { productId, name: part.name, dimensions: part.dimensions ?? null },
      });
      if (existing) {
        details.push({ name: part.name, status: "skipped", message: "Уже есть в изделии" });
        continue;
      }

      await prisma.part.create({
        data: {
          productId,
          name: part.name,
          code: part.code,
          dimensions: part.dimensions,
          quantity: part.quantity,
          material: part.material,
        },
      });
      created++;
      details.push({ name: part.name, status: "created" });
    }

    if (savePdf) {
      await prisma.document.create({
        data: {
          productId,
          type: "PART_DETAIL",
          filename: saved.filename,
          filepath: saved.filepath,
          storageProvider: saved.storageProvider,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      created,
      total: parsed.parts.length,
      pageNumber: parsed.pageNumber,
      method: parsed.method ?? "text",
      previewLines: parsed.previewLines,
      details,
      product: {
        number: product.number,
        name: product.name,
        orderNumber: product.order.number,
      },
    });
  } catch (error) {
    console.error("PDF parts import error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ошибка разбора PDF",
      },
      { status: 500 },
    );
  }
}
