import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { buildAssemblyHints, entriesFromSystemParts } from "@/lib/assembly-guide";
import { fileApiUrl } from "@/lib/file-url";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSession();
    if (!canAccess(user.role, ["ADMIN", "SORTER", "MANAGER", "CONTRACTOR", "DRILLER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { id: productId } = await params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        number: true,
        name: true,
        order: { select: { number: true } },
        documents: {
          where: { type: { in: ["ASSEMBLY_DRAWING", "PART_DETAIL"] } },
          orderBy: { uploadedAt: "desc" },
          take: 2,
          select: {
            id: true,
            filename: true,
            filepath: true,
            storageProvider: true,
            type: true,
          },
        },
        parts: {
          orderBy: [{ sectionOrder: "asc" }, { specNumber: "asc" }, { name: "asc" }],
          select: {
            id: true,
            specNumber: true,
            name: true,
            code: true,
            module: true,
            length: true,
            width: true,
            dimensions: true,
            quantity: true,
            material: true,
            sectionOrder: true,
            status: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Изделие не найдено" }, { status: 404 });
    }

    const assemblyDoc =
      product.documents.find((d) => d.type === "ASSEMBLY_DRAWING") ??
      product.documents.find((d) => d.type === "PART_DETAIL") ??
      null;

    const allParts = product.parts;
    const systemEntries = entriesFromSystemParts(allParts);
    const sortParts = allParts.filter((p) => p.status === "RECEIVED");

    if (!assemblyDoc) {
      const hints = buildAssemblyHints(sortParts, systemEntries);
      return NextResponse.json({
        document: null,
        product: { number: product.number, name: product.name, orderNumber: product.order.number },
        hints: hintsToObject(hints),
        errors: systemEntries.length
          ? []
          : ["Сборочный чертёж не загружен. Импортируйте Excel на странице заказа."],
      });
    }

    const hints = buildAssemblyHints(sortParts, systemEntries);

    return NextResponse.json({
      document: {
        id: assemblyDoc.id,
        filename: assemblyDoc.filename,
        filepath: assemblyDoc.filepath,
        type: assemblyDoc.type,
        fileUrl: fileApiUrl(assemblyDoc.filepath, assemblyDoc.storageProvider),
      },
      product: { number: product.number, name: product.name, orderNumber: product.order.number },
      hints: hintsToObject(hints),
      errors: [],
    });
  } catch (error) {
    console.error("Assembly guide error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка чтения чертежа" },
      { status: 500 },
    );
  }
}

function hintsToObject(
  hintsMap: ReturnType<typeof buildAssemblyHints>,
): Record<
  string,
  { position: string; name: string; module?: string; dimensions?: string; message: string }
> {
  return Object.fromEntries(
    [...hintsMap.entries()].map(([partId, hint]) => {
      const module = hint.entry.module;
      const moduleText = module ? `Модуль ${module} — ` : "";
      return [
        partId,
        {
          position: hint.entry.position,
          name: hint.entry.name,
          module,
          dimensions: hint.entry.dimensions,
          message: `${moduleText}Поз. ${hint.entry.position} — ${hint.entry.name}${
            hint.entry.dimensions ? ` (${hint.entry.dimensions})` : ""
          }`,
        },
      ];
    }),
  );
}
