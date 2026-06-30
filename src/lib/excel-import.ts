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
import { readFileBuffer } from "@/lib/storage";
import { resolveUploadFromForm } from "@/lib/resolve-upload";

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
  const toCreate: Array<{
    productId: string;
    specNumber?: number;
    name: string;
    code?: string;
    module: string | null;
    length?: string;
    width?: string;
    dimensions?: string;
    quantity: number;
    material?: string;
    sectionOrder?: number;
    edging?: string;
    groove?: string;
    rectangular?: string;
    row: ImportedPartRow;
    product: (typeof orderProducts)[number];
  }> = [];

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
    toCreate.push({
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
      row,
      product,
    });
  }

  if (toCreate.length > 0) {
    await prisma.part.createMany({
      data: toCreate.map(({ row: _row, product: _product, ...data }) => data),
    });
    created = toCreate.length;
    for (const item of toCreate) {
      details.push({
        row: item.row.sourceRow,
        name: item.row.name,
        productNumber: item.row.productNumber,
        status: "created",
        target: `№${item.product.number} «${item.product.name}»`,
        kind: "part",
      });
    }
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
  const toCreate: Array<{
    productId: string;
    specNumber?: number;
    code?: string;
    name: string;
    quantity: number;
    unit?: string;
    row: ImportedHardwareRow;
    product: (typeof orderProducts)[number];
  }> = [];

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
    toCreate.push({
      productId: product.id,
      specNumber: row.specNumber,
      code: row.code,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      row,
      product,
    });
  }

  if (toCreate.length > 0) {
    await prisma.hardwareItem.createMany({
      data: toCreate.map(({ row: _row, product: _product, ...data }) => data),
    });
    created = toCreate.length;
    for (const item of toCreate) {
      details.push({
        row: item.row.sourceRow,
        name: item.row.name,
        productNumber: item.row.productNumber,
        status: "created",
        target: `№${item.product.number} «${item.product.name}»`,
        kind: "hardware",
      });
    }
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
  const importType = String(formData.get("type") ?? "specification");

  if (!orderId) {
    return { error: "Нужен orderId", status: 400 as const };
  }

  let buffer: ArrayBuffer;
  const saved = await resolveUploadFromForm(formData, `imports/${orderId}`);
  const file = formData.get("file");

  if (saved) {
    const data = await readFileBuffer(saved.filepath, saved.storageProvider);
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else if (file instanceof File && file.size > 0) {
    buffer = await file.arrayBuffer();
  } else {
    return { error: "Нужен файл Excel", status: 400 as const };
  }

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
