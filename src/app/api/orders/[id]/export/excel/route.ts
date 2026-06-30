import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionFromDb } from "@/lib/session";
import {
  buildBazisSpecificationWorkbook,
  buildSplitSpecificationWorkbook,
  type ExportOrder,
} from "@/lib/excel-export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSessionFromDb();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "bazis" ? "bazis" : "split";

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { number: "asc" },
        include: {
          parts: { orderBy: [{ sectionOrder: "asc" }, { specNumber: "asc" }, { name: "asc" }] },
          hardware: { orderBy: { name: "asc" } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const exportOrder: ExportOrder = {
    number: order.number,
    title: order.title,
    products: order.products.map((product) => ({
      number: product.number,
      name: product.name,
      parts: product.parts.map((part) => ({
        specNumber: part.specNumber,
        name: part.name,
        code: part.code,
        length: part.length,
        width: part.width,
        dimensions: part.dimensions,
        quantity: part.quantity,
        material: part.material,
        edging: part.edging,
        groove: part.groove,
        rectangular: part.rectangular,
      })),
      hardware: product.hardware.map((item) => ({
        specNumber: item.specNumber,
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    })),
  };

  const buffer =
    format === "bazis"
      ? buildBazisSpecificationWorkbook(exportOrder)
      : buildSplitSpecificationWorkbook(exportOrder);

  const suffix = format === "bazis" ? "bazis" : "materials";
  const filename = `spec_${order.number}_${suffix}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
