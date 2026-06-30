import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";

export default async function DrillPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "DRILLER", "MANAGER"])) redirect("/login");

  const orders = await prisma.order.findMany({
    where: {
      products: { some: { parts: { some: { status: "SORTED" } } } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      title: true,
      products: {
        where: { parts: { some: { status: "SORTED" } } },
        select: {
          id: true,
          number: true,
          name: true,
          _count: { select: { parts: true } },
          parts: {
            where: { status: "SORTED" },
            select: { id: true },
          },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-2">Присадка</h1>
      <p className="font-medium text-black mb-6">
        Откройте изделие — сборочный чертёж, детали по модулям и схема отверстий из деталировки.
      </p>

      <h2 className="font-bold text-black text-lg mb-4">Заказы</h2>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          Нет деталей на присадке
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl bg-white border border-slate-200 p-4">
              <h2 className="font-bold text-lg text-black mb-3">
                Заказ {order.number}
                {order.title && <span className="font-medium"> — {order.title}</span>}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {order.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/workflow/drill/${product.id}`}
                    className="rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                  >
                    <p className="font-bold text-black">
                      Изделие {product.number} — {product.name}
                    </p>
                    <p className="text-sm font-medium text-black mt-1">
                      К присадке: {product.parts.length} из {product._count.parts} деталей
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
