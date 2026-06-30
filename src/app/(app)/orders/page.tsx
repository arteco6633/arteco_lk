import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) redirect("/login");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        include: {
          _count: { select: { parts: true } },
        },
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Заказы</h1>
          <p className="font-medium text-black">Управление заказами и документами</p>
        </div>
        <Link
          href="/orders/new"
          className="rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold"
        >
          + Новый заказ
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          Заказов пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-2xl bg-white border border-slate-200 p-4 hover:bg-slate-50"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="font-bold text-lg text-black">Заказ {order.number}</h2>
                  {order.title && <p className="font-medium text-black">{order.title}</p>}
                </div>
                <p className="text-sm font-medium text-black">
                  {order.products.length} изделий ·{" "}
                  {order.products.reduce((sum, p) => sum + p._count.parts, 0)} деталей
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
