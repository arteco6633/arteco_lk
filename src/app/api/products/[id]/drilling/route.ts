import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { matchDetailPage } from "@/lib/drilling-types";
import {
  createDrillOcrWorker,
  openDetailPdf,
  parseDetailPdfPageFromDoc,
} from "@/lib/pdf-drilling";
import { readFileBuffer } from "@/lib/storage";

export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSession();
    if (!canAccess(user.role, ["ADMIN", "DRILLER", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const dimensions = searchParams.get("dimensions");

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        documents: {
          where: { type: "PART_DETAIL" },
          orderBy: { uploadedAt: "desc" },
          take: 1,
          select: { id: true, filename: true, filepath: true, storageProvider: true },
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

    const buffer = await readFileBuffer(doc.filepath, doc.storageProvider);
    const pdf = await openDetailPdf(buffer);
    const worker = await createDrillOcrWorker();
    const documentMeta = { id: doc.id, filename: doc.filename };

    try {
      if (pageParam) {
        const pageNumber = Number(pageParam);
        const drilling = await parseDetailPdfPageFromDoc(pdf, pageNumber, worker);
        return NextResponse.json({ drilling, document: documentMeta });
      }

      const maxPages = Math.min(pdf.numPages, 15);

      if (dimensions) {
        let first: Awaited<ReturnType<typeof parseDetailPdfPageFromDoc>> | null = null;
        for (let p = 1; p <= maxPages; p++) {
          const page = await parseDetailPdfPageFromDoc(pdf, p, worker);
          if (!first) first = page;
          if (matchDetailPage([page], dimensions)) {
            return NextResponse.json({
              drilling: page,
              matchedPage: p,
              document: documentMeta,
            });
          }
        }
        return NextResponse.json({
          drilling: first,
          matchedPage: first?.pageNumber ?? 1,
          document: documentMeta,
        });
      }

      const pages = [];
      for (let p = 1; p <= maxPages; p++) {
        try {
          pages.push(await parseDetailPdfPageFromDoc(pdf, p, worker));
        } catch {
          break;
        }
      }

      return NextResponse.json({
        drilling: pages[0] ?? null,
        pages,
        pageCount: pages.length,
        document: documentMeta,
      });
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    console.error("Drilling parse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка разбора деталировки" },
      { status: 500 },
    );
  }
}
