import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) redirect("/login");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        include: {
          hardware: {
            select: { id: true, purchased: true },
          },
        },
      },
    },
  });

  const activeOrders = orders
    .map((order) => {
      const hardware = order.products.flatMap((p) => p.hardware);
      const total = hardware.length;
      const pending = hardware.filter((h) => !h.purchased).length;
      const productsWithHardware = order.products.filter((p) => p.hardware.length > 0).length;
      return { ...order, total, pending, productsWithHardware };
    })
    .filter((order) => order.total > 0);

  return (
    <div className="w-full max-w-none">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-2">Закупка фурнитуры</h1>
      <p className="font-medium text-black mb-6 text-sm sm:text-base">
        Спецификация на фурнитуру из Excel — отметьте закупленные позиции перед производством
      </p>

      {activeOrders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          Нет заказов с фурнитурой. Импортируйте Excel на странице заказа.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeOrders.map((order) => (
            <Link
              key={order.id}
              href={`/workflow/procurement/${order.id}`}
              className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 hover:bg-slate-50 transition-colors"
            >
              <p className="font-bold text-lg text-black">
                Заказ {order.number}
                {order.title && (
                  <span className="block sm:inline font-medium text-base"> — {order.title}</span>
                )}
              </p>
              <p className="text-sm font-medium text-black mt-2">
                {order.productsWithHardware} изд. · {order.total} поз. фурнитуры
              </p>
              {order.pending > 0 ? (
                <p className="text-sm font-bold text-amber-800 mt-2">
                  К закупке: {order.pending}
                </p>
              ) : (
                <p className="text-sm font-bold text-emerald-700 mt-2">Всё закуплено ✓</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
