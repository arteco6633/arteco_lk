import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { ReceiptOrderPartSearch } from "@/components/ReceiptPartSearch";

export default async function ReceiptOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "CONTRACTOR", "MANAGER"])) redirect("/login");

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      products: {
        orderBy: { number: "asc" },
        include: {
          _count: { select: { parts: true } },
          parts: {
            where: { status: "CREATED" },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const products = order.products.filter((p) => p.parts.length > 0);

  return (
    <div>
      <Link href="/workflow/receipt" className="text-sm text-blue-600 hover:underline">
        ← К списку заказов
      </Link>
      <h1 className="text-2xl font-bold text-black mt-3 mb-1">Заказ {order.number}</h1>
      {order.title && <p className="font-medium text-black mb-6">{order.title}</p>}
      {!order.title && <div className="mb-2" />}

      <ReceiptOrderPartSearch orderId={order.id} />

      <h2 className="font-bold text-black mb-3">Изделия</h2>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          В этом заказе нет деталей на приёмке
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/workflow/receipt/${order.id}/${product.id}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
            >
              <p className="font-bold text-black">
                Изделие {product.number} — {product.name}
              </p>
              <p className="text-sm font-medium text-black mt-1">
                К приёмке: {product.parts.length} из {product._count.parts} деталей
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
