import { prisma } from "@/lib/db";
import { parseCatalogExcel, slugify } from "@/lib/catalog-excel";
import { readFileBuffer } from "@/lib/storage";
import type { CatalogItemType, Prisma, StorageProvider } from "@prisma/client";

export type CatalogImportMode = "merge" | "replace";

const TX_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
const UPDATE_BATCH = 50;

type ItemData = {
  subcategory?: string;
  name: string;
  code?: string;
  type: CatalogItemType;
  unit: Prisma.CatalogItemCreateManyInput["unit"];
  platePrice?: number;
  heightM?: number;
  widthM?: number;
  sheetAreaSqm?: number;
  costPrice?: number;
  clientPrice?: number;
  link?: string;
  sourceSheet?: string;
  sourceRow?: number;
};

function toItemData(item: {
  subcategory?: string;
  name: string;
  code?: string;
  type: CatalogItemType;
  unit: Prisma.CatalogItemCreateManyInput["unit"];
  platePrice?: number;
  heightM?: number;
  widthM?: number;
  sheetAreaSqm?: number;
  costPrice?: number;
  clientPrice?: number;
  link?: string;
  sheetName: string;
  sourceRow: number;
}): ItemData {
  return {
    subcategory: item.subcategory,
    name: item.name,
    code: item.code,
    type: item.type,
    unit: item.unit,
    platePrice: item.platePrice,
    heightM: item.heightM,
    widthM: item.widthM,
    sheetAreaSqm: item.sheetAreaSqm,
    costPrice: item.costPrice,
    clientPrice: item.clientPrice,
    link: item.link,
    sourceSheet: item.sheetName,
    sourceRow: item.sourceRow,
  };
}

async function flushUpdates(
  tx: Prisma.TransactionClient,
  updates: Array<{ id: string; data: ItemData }>,
) {
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = updates.slice(i, i + UPDATE_BATCH);
    await Promise.all(
      batch.map(({ id, data }) =>
        tx.catalogItem.update({
          where: { id },
          data: { ...data, active: true },
        }),
      ),
    );
  }
}

export async function runCatalogImport(params: {
  buffer: Buffer;
  filename: string;
  mode: CatalogImportMode;
  importedBy: string;
}) {
  const parsed = parseCatalogExcel(params.buffer);

  if (parsed.sheets.length === 0) {
    return {
      error: parsed.errors[0] ?? "Файл пуст или не распознан",
      status: 400 as const,
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let itemCount = 0;
  const importErrors: string[] = [...parsed.errors];

  for (let sheetIndex = 0; sheetIndex < parsed.sheets.length; sheetIndex++) {
    const sheet = parsed.sheets[sheetIndex];

    try {
      await prisma.$transaction(async (tx) => {
        let category = await tx.catalogCategory.findFirst({ where: { name: sheet.name } });

        if (category) {
          category = await tx.catalogCategory.update({
            where: { id: category.id },
            data: { type: sheet.type, sortOrder: sheetIndex },
          });
        } else {
          let slug = slugify(sheet.name);
          let n = 1;
          while (await tx.catalogCategory.findUnique({ where: { slug } })) {
            slug = `${slugify(sheet.name)}-${n++}`;
          }
          category = await tx.catalogCategory.create({
            data: {
              name: sheet.name,
              slug,
              type: sheet.type,
              sortOrder: sheetIndex,
            },
          });
        }

        if (params.mode === "replace") {
          await tx.catalogItem.deleteMany({ where: { categoryId: category.id } });
        }

        const existingItems =
          params.mode === "merge"
            ? await tx.catalogItem.findMany({
                where: { categoryId: category.id },
                select: { id: true, name: true, subcategory: true },
              })
            : [];

        const existingMap = new Map(
          existingItems.map((row) => [
            `${row.subcategory ?? ""}::${row.name.toLowerCase()}`,
            row.id,
          ]),
        );

        const toCreate: Prisma.CatalogItemCreateManyInput[] = [];
        const toUpdate: Array<{ id: string; data: ItemData }> = [];

        for (const item of sheet.items) {
          itemCount++;
          const key = `${item.subcategory ?? ""}::${item.name.toLowerCase()}`;
          const existingId = existingMap.get(key);
          const data = toItemData(item);

          if (existingId) {
            toUpdate.push({ id: existingId, data });
          } else {
            toCreate.push({ ...data, categoryId: category.id, active: true });
          }
        }

        if (toCreate.length > 0) {
          const result = await tx.catalogItem.createMany({ data: toCreate });
          createdCount += result.count;
        }

        if (toUpdate.length > 0) {
          await flushUpdates(tx, toUpdate);
          updatedCount += toUpdate.length;
        }
      }, TX_OPTIONS);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка импорта листа";
      importErrors.push(`Лист «${sheet.name}»: ${message}`);
    }
  }

  if (createdCount === 0 && updatedCount === 0 && importErrors.length > parsed.errors.length) {
    return {
      error: importErrors.find((e) => e.startsWith("Лист")) ?? "Не удалось импортировать файл",
      status: 500 as const,
    };
  }

  await prisma.catalogImport.create({
    data: {
      filename: params.filename,
      sheetCount: parsed.sheets.length,
      itemCount,
      createdCount,
      updatedCount,
      skippedCount: parsed.skipped,
      errors: importErrors.length > 0 ? importErrors.slice(0, 50).join("\n") : null,
      importedBy: params.importedBy,
    },
  });

  return {
    body: {
      ok: true,
      sheetCount: parsed.sheets.length,
      itemCount,
      createdCount,
      updatedCount,
      skipped: parsed.skipped,
      errors: importErrors,
      sheets: parsed.sheets.map((s) => ({
        name: s.name,
        type: s.type,
        count: s.items.length,
      })),
    },
  };
}

export async function parseCatalogFromFormData(formData: FormData) {
  const file = formData.get("file");
  const filepath = formData.get("filepath");
  const filename = String(formData.get("filename") ?? "");
  const mode = String(formData.get("mode") ?? "merge") as CatalogImportMode;

  if (mode !== "merge" && mode !== "replace") {
    return { error: "mode должен быть merge или replace", status: 400 as const };
  }

  let buffer: Buffer;
  let resolvedName = filename;

  if (filepath && typeof filepath === "string") {
    const storageProvider = (
      String(formData.get("storageProvider") ?? "LOCAL") === "SUPABASE" ? "SUPABASE" : "LOCAL"
    ) as StorageProvider;
    buffer = await readFileBuffer(filepath, storageProvider);
    resolvedName = resolvedName || filepath.split("/").pop() || "catalog.xlsx";
  } else if (file instanceof File) {
    buffer = Buffer.from(await file.arrayBuffer());
    resolvedName = resolvedName || file.name;
  } else {
    return { error: "Нужен файл Excel (.xlsx)", status: 400 as const };
  }

  if (!/\.(xlsx|xls|xlsm)$/i.test(resolvedName)) {
    return { error: "Поддерживаются файлы .xlsx, .xls, .xlsm", status: 400 as const };
  }

  return { buffer, filename: resolvedName, mode };
}
