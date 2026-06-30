import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";

export default async function ReceiptPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "CONTRACTOR", "MANAGER"])) redirect("/login");

  const orders = await prisma.order.findMany({
    where: {
      products: { some: { parts: { some: { status: "CREATED" } } } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      title: true,
      products: {
        where: { parts: { some: { status: "CREATED" } } },
        select: {
          id: true,
          parts: {
            where: { status: "CREATED" },
            select: { id: true },
          },
        },
      },
    },
  });

  const activeOrders = orders.map((order) => {
    const pendingParts = order.products.reduce((sum, p) => sum + p.parts.length, 0);
    const pendingProducts = order.products.length;
    return { ...order, pendingParts, pendingProducts };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-2">Приёмка у подрядчика</h1>
      <p className="font-medium text-black mb-6">
        Выберите заказ, затем изделие — и отметьте принятые детали
      </p>

      {activeOrders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          Нет деталей на приёмке
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activeOrders.map((order) => (
            <Link
              key={order.id}
              href={`/workflow/receipt/${order.id}`}
              className="rounded-2xl bg-white border border-slate-200 p-5 hover:bg-slate-50"
            >
              <p className="font-bold text-lg text-black">
                Заказ {order.number}
                {order.title && <span className="font-medium"> — {order.title}</span>}
              </p>
              <p className="text-sm font-medium text-black mt-2">
                {order.pendingProducts} изд. · {order.pendingParts} дет. к приёмке
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
