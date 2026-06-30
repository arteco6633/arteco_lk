import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import {
  parseHardwareExcel,
  parsePartsExcel,
  parseSpecificationExcel,
  type ImportedHardwareRow,
  type ImportedPartRow,
} from "@/lib/excel";
import { extractModuleFromName } from "@/lib/module";
import { findProductForImport } from "@/lib/products";
import { assignSectionOrder } from "@/lib/specification-groups";

type ImportDetail = {
  row: number;
  name: string;
  productNumber: string;
  status: "created" | "not_found" | "skipped";
  target?: string;
  message?: string;
  kind?: "part" | "hardware";
};

function productListLabel(
  products: Array<{ number: string; name: string }>,
): string {
  return products.map((p) => `№${p.number} «${p.name}»`).join(", ");
}

async function importParts(
  orderProducts: NonNullable<Awaited<ReturnType<typeof loadOrder>>>["products"],
  rows: ImportedPartRow[],
  errors: string[],
) {
  const details: ImportDetail[] = [];
  let created = 0;
  let notFound = 0;
  const rowsWithOrder = assignSectionOrder(rows);

  for (const row of rowsWithOrder) {
    const product = findProductForImport(orderProducts, row);
    if (!product) {
      notFound++;
      const message = `Изделие не найдено (№${row.productNumber}${row.productName ? `, «${row.productName}»` : ""}). В заказе: ${productListLabel(orderProducts)}`;
      errors.push(`Строка ${row.sourceRow} «${row.name}»: ${message}`);
      details.push({
        row: row.sourceRow,
        name: row.name,
        productNumber: row.productNumber,
        status: "not_found",
        message,
        kind: "part",
      });
      continue;
    }
    await prisma.part.create({
      data: {
        productId: product.id,
        specNumber: row.specNumber,
        name: row.name,
        code: row.code,
        module: extractModuleFromName(row.name),
        length: row.length,
        width: row.width,
        dimensions: row.dimensions,
        quantity: row.quantity,
        material: row.material,
        sectionOrder: row.sectionOrder,
        edging: row.edging,
        groove: row.groove,
        rectangular: row.rectangular,
      },
    });
    created++;
    details.push({
      row: row.sourceRow,
      name: row.name,
      productNumber: row.productNumber,
      status: "created",
      target: `№${product.number} «${product.name}»`,
      kind: "part",
    });
  }

  return { created, notFound, details };
}

async function importHardware(
  orderProducts: NonNullable<Awaited<ReturnType<typeof loadOrder>>>["products"],
  rows: ImportedHardwareRow[],
  errors: string[],
) {
  const details: ImportDetail[] = [];
  let created = 0;
  let notFound = 0;

  for (const row of rows) {
    const product = findProductForImport(orderProducts, row);
    if (!product) {
      notFound++;
      const message = `Изделие не найдено (№${row.productNumber}${row.productName ? `, «${row.productName}»` : ""}). В заказе: ${productListLabel(orderProducts)}`;
      errors.push(`Строка ${row.sourceRow} «${row.name}»: ${message}`);
      details.push({
        row: row.sourceRow,
        name: row.name,
        productNumber: row.productNumber,
        status: "not_found",
        message,
        kind: "hardware",
      });
      continue;
    }
    await prisma.hardwareItem.create({
      data: {
        productId: product.id,
        specNumber: row.specNumber,
        code: row.code,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
      },
    });
    created++;
    details.push({
      row: row.sourceRow,
      name: row.name,
      productNumber: row.productNumber,
      status: "created",
      target: `№${product.number} «${product.name}»`,
      kind: "hardware",
    });
  }

  return { created, notFound, details };
}

async function loadOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { products: { orderBy: { number: "asc" } } },
  });
  if (!order) return null;
  return order;
}

export async function POST(request: Request) {
  try {
    await requireSessionFromDb();
    const formData = await request.formData();
    const orderId = String(formData.get("orderId") ?? "");
    const file = formData.get("file");
    const importType = String(formData.get("type") ?? "specification");

    if (!orderId || !(file instanceof File)) {
      return NextResponse.json({ error: "Нужны orderId и файл Excel" }, { status: 400 });
    }

    const order = await loadOrder(orderId);
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

    const buffer = await file.arrayBuffer();
    const availableProducts = productListLabel(order.products);

    if (importType === "specification") {
      const { parts, hardware, skipped, errors } = parseSpecificationExcel(buffer);
      const partsResult = await importParts(order.products, parts, errors);
      const hwResult = await importHardware(order.products, hardware, errors);

      return NextResponse.json({
        ok: true,
        created: partsResult.created + hwResult.created,
        partsCreated: partsResult.created,
        hardwareCreated: hwResult.created,
        total: parts.length + hardware.length,
        skipped,
        notFound: partsResult.notFound + hwResult.notFound,
        errors,
        details: [...partsResult.details, ...hwResult.details],
        availableProducts,
      });
    }

    if (importType === "hardware") {
      const { rows, skipped, errors } = parseHardwareExcel(buffer);
      const result = await importHardware(order.products, rows, errors);
      return NextResponse.json({
        ok: true,
        created: result.created,
        total: rows.length,
        skipped,
        notFound: result.notFound,
        errors,
        details: result.details,
        availableProducts,
      });
    }

    const { rows, skipped, errors } = parsePartsExcel(buffer);
    const result = await importParts(order.products, rows, errors);

    return NextResponse.json({
      ok: true,
      created: result.created,
      total: rows.length,
      skipped,
      notFound: result.notFound,
      errors,
      details: result.details,
      availableProducts,
    });
  } catch (error) {
    console.error("Excel import failed:", error);
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка при импорте";
    const isPrismaSchema =
      message.includes("Unknown argument") || message.includes("PrismaClient");
    return NextResponse.json(
      {
        error: isPrismaSchema
          ? "Ошибка базы данных. Перезапустите сервер после обновления (npm run dev)."
          : message,
      },
      { status: 500 },
    );
  }
}
