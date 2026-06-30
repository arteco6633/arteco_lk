import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { matchDetailPage } from "@/lib/drilling-types";
import { parseDetailPdfPage } from "@/lib/pdf-drilling";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionFromDb();
    if (!canAccess(user.role, ["ADMIN", "DRILLER", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const dimensions = searchParams.get("dimensions");
    const allPages = searchParams.get("all") === "1";

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        documents: {
          where: { type: "PART_DETAIL" },
          orderBy: { uploadedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Изделие не найдено" }, { status: 404 });
    }

    const doc = product.documents[0];
    if (!doc) {
      return NextResponse.json({ error: "Деталировка не загружена" }, { status: 404 });
    }

    const fullPath = path.join(process.cwd(), "uploads", doc.filepath);
    const buffer = await readFile(fullPath);

    if (pageParam) {
      const pageNumber = Number(pageParam);
      const drilling = await parseDetailPdfPage(buffer, pageNumber);
      return NextResponse.json({ drilling, document: { id: doc.id, filename: doc.filename } });
    }

    const pages = [];
    for (let p = 1; p <= 15; p++) {
      try {
        pages.push(await parseDetailPdfPage(buffer, p));
      } catch {
        break;
      }
    }

    if (allPages) {
      return NextResponse.json({
        pages,
        pageCount: pages.length,
        document: { id: doc.id, filename: doc.filename },
      });
    }

    const drilling = matchDetailPage(pages, dimensions) ?? pages[0];

    return NextResponse.json({
      drilling,
      matchedPage: drilling?.pageNumber,
      document: { id: doc.id, filename: doc.filename },
    });
  } catch (error) {
    console.error("Drilling parse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка разбора деталировки" },
      { status: 500 },
    );
  }
}
