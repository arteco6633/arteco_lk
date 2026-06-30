import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { productNeedsPacking } from "@/lib/products";
import { PackProductCard } from "@/components/PackProductCard";

export default async function PackPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "PACKER", "MANAGER"])) redirect("/login");

  const allProducts = await prisma.product.findMany({
    where: {
      parts: {
        some: {
          status: { in: ["QC_PASSED", "PACKED"] },
        },
      },
    },
    select: {
      id: true,
      orderId: true,
      number: true,
      name: true,
      order: { select: { number: true } },
      parts: {
        where: { status: { in: ["QC_PASSED", "PACKED"] } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          dimensions: true,
          quantity: true,
          status: true,
        },
      },
      hardware: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, quantity: true, unit: true, packed: true },
      },
      documents: {
        where: { type: { in: ["ASSEMBLY_DRAWING", "LABEL"] } },
        select: {
          id: true,
          type: true,
          filename: true,
          filepath: true,
          storageProvider: true,
        },
      },
    },
    orderBy: [{ order: { number: "asc" } }, { number: "asc" }],
  });

  const products = allProducts.filter(productNeedsPacking);

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-2">Упаковка</h1>
      <p className="font-medium text-black mb-6">
        Соберите комплект деталей и фурнитуры. Распечатайте сборочный чертёж и бирку для каждого
        изделия.
      </p>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          Нет изделий, ожидающих упаковки
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <PackProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
