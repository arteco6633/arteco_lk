import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { ReceiptProductPartList } from "@/components/ReceiptPartSearch";

export default async function ReceiptProductPage({
  params,
}: {
  params: Promise<{ orderId: string; productId: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "CONTRACTOR", "MANAGER"])) redirect("/login");

  const { orderId, productId } = await params;
  const product = await prisma.product.findFirst({
    where: { id: productId, orderId },
    include: {
      order: true,
      parts: {
        where: { status: "CREATED" },
        orderBy: [{ sectionOrder: "asc" }, { specNumber: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!product) notFound();

  const parts = product.parts.map((part) => ({
    ...part,
    product: {
      number: product.number,
      name: product.name,
      order: product.order,
    },
  }));

  return (
    <div>
      <Link
        href={`/workflow/receipt/${orderId}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← К изделиям заказа
      </Link>
      <h1 className="text-2xl font-bold text-black mt-3 mb-1">
        Изделие {product.number} — {product.name}
      </h1>
      <p className="font-medium text-black mb-6">Заказ {product.order.number}</p>

      <ReceiptProductPartList parts={parts} />
    </div>
  );
}
