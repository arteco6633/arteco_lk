import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { ProcurementProductCard } from "@/components/ProcurementHardwareList";

export default async function ProcurementOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) redirect("/login");

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      products: {
        include: {
          hardware: {
            orderBy: [{ specNumber: "asc" }, { name: "asc" }],
          },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!order) notFound();

  const productsWithHardware = order.products.filter((p) => p.hardware.length > 0);
  const allHardware = productsWithHardware.flatMap((p) => p.hardware);
  const pending = allHardware.filter((h) => !h.purchased).length;

  return (
    <div className="w-full max-w-none">
      <Link href="/workflow/procurement" className="text-sm text-blue-600 hover:underline">
        ← К закупке
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-black">
          Заказ {order.number}
          {order.title && <span className="font-medium"> — {order.title}</span>}
        </h1>
        <p className="font-medium text-black mt-1 text-sm sm:text-base">
          {allHardware.length} позиций фурнитуры
          {pending > 0 ? ` · к закупке: ${pending}` : " · всё закуплено"}
        </p>
      </div>

      {productsWithHardware.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center font-medium text-black">
          В этом заказе нет фурнитуры. Импортируйте Excel на странице{" "}
          <Link href={`/orders/${order.id}`} className="text-blue-600 underline">
            заказа
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-5">
          {productsWithHardware.map((product) => (
            <ProcurementProductCard
              key={product.id}
              productNumber={product.number}
              productName={product.name}
              hardware={product.hardware.map((item) => ({
                ...item,
                purchasedAt: item.purchasedAt?.toISOString() ?? null,
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
