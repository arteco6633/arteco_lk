import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { DrillPartList } from "@/components/DrillPartList";

export default async function DrillPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "DRILLER", "MANAGER"])) redirect("/login");

  const parts = await prisma.part.findMany({
    where: { status: "SORTED" },
    include: {
      product: {
        include: {
          order: true,
          documents: {
            where: { type: "PART_DETAIL" },
            orderBy: { uploadedAt: "desc" },
          },
        },
      },
    },
    orderBy: [{ product: { order: { number: "asc" } } }, { name: "asc" }],
  });

  const mappedParts = parts.map((part) => ({
    id: part.id,
    name: part.name,
    code: part.code,
    dimensions: part.dimensions,
    quantity: part.quantity,
    material: part.material,
    status: part.status,
    product: {
      id: part.product.id,
      number: part.product.number,
      name: part.product.name,
      order: part.product.order,
      documents: part.product.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        filepath: d.filepath,
      })),
    },
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-2">Присадка</h1>
      <p className="font-medium text-black mb-6">
        Деталировка открыта ниже по каждому изделию. Сделайте присадку, сфотографируйте деталь и
        отметьте выполненной.
      </p>

      <DrillPartList parts={mappedParts} />
    </div>
  );
}
