import { NextResponse } from "next/server";
import type {
  ImportedHardwareRow,
  ImportedPartRow,
  SpecificationParseResult,
} from "@/lib/excel";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import { extractModuleFromName } from "@/lib/module";
import { findProductForImport } from "@/lib/products";
import { assignSectionOrder } from "@/lib/specification-groups";
import { syncOrderStatus } from "@/lib/orders";

export type ImportDetail = {
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

async function loadOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { products: { orderBy: { number: "asc" } } },
  });
  if (!order) return null;
  return order;
}

export async function importParts(
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

export async function importHardware(
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

type ImportPayload = {
  orderId: string;
  type: "specification" | "parts" | "hardware";
  parts?: ImportedPartRow[];
  hardware?: ImportedHardwareRow[];
  rows?: ImportedPartRow[] | ImportedHardwareRow[];
  skipped?: number;
  errors?: string[];
};

export async function runExcelImport(payload: ImportPayload) {
  const { orderId, type } = payload;
  const order = await loadOrder(orderId);
  if (!order) return { error: "Заказ не найден", status: 404 as const };

  const availableProducts = productListLabel(order.products);
  const errors = [...(payload.errors ?? [])];

  if (type === "specification") {
    const parts = payload.parts ?? [];
    const hardware = payload.hardware ?? [];
    const skipped = payload.skipped ?? 0;
    const partsResult = await importParts(order.products, parts, errors);
    const hwResult = await importHardware(order.products, hardware, errors);
    await syncOrderStatus(orderId);

    return {
      status: 200 as const,
      body: {
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
      },
    };
  }

  if (type === "hardware") {
    const rows = (payload.rows ?? []) as ImportedHardwareRow[];
    const result = await importHardware(order.products, rows, errors);
    await syncOrderStatus(orderId);
    return {
      status: 200 as const,
      body: {
        ok: true,
        created: result.created,
        total: rows.length,
        skipped: payload.skipped ?? 0,
        notFound: result.notFound,
        errors,
        details: result.details,
        availableProducts,
      },
    };
  }

  const rows = (payload.rows ?? payload.parts ?? []) as ImportedPartRow[];
  const result = await importParts(order.products, rows, errors);
  await syncOrderStatus(orderId);

  return {
    status: 200 as const,
    body: {
      ok: true,
      created: result.created,
      total: rows.length,
      skipped: payload.skipped ?? 0,
      notFound: result.notFound,
      errors,
      details: result.details,
      availableProducts,
    },
  };
}

export async function parseExcelFromFormData(formData: FormData) {
  const {
    parseHardwareExcel,
    parsePartsExcel,
    parseSpecificationExcel,
  } = await import("@/lib/excel");

  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");
  const importType = String(formData.get("type") ?? "specification");

  if (!orderId || !(file instanceof File)) {
    return { error: "Нужны orderId и файл Excel", status: 400 as const };
  }

  const buffer = await file.arrayBuffer();

  if (importType === "specification") {
    const parsed: SpecificationParseResult = parseSpecificationExcel(buffer);
    return {
      payload: {
        orderId,
        type: "specification" as const,
        parts: parsed.parts,
        hardware: parsed.hardware,
        skipped: parsed.skipped,
        errors: parsed.errors,
      },
    };
  }

  if (importType === "hardware") {
    const parsed = parseHardwareExcel(buffer);
    return {
      payload: {
        orderId,
        type: "hardware" as const,
        rows: parsed.rows,
        skipped: parsed.skipped,
        errors: parsed.errors,
      },
    };
  }

  const parsed = parsePartsExcel(buffer);
  return {
    payload: {
      orderId,
      type: "parts" as const,
      rows: parsed.rows,
      skipped: parsed.skipped,
      errors: parsed.errors,
    },
  };
}
