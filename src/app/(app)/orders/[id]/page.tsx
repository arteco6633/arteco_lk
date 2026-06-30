import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess, STATUS_LABELS } from "@/lib/constants";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentList } from "@/components/DocumentList";
import { ProductSpecification } from "@/components/ProductSpecification";
import { DeleteOrderButton } from "@/components/DeleteOrderButton";
import { ExcelImport } from "@/components/ExcelImport";
import { PdfPartsImport } from "@/components/PdfPartsImport";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) redirect("/login");

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          parts: { orderBy: [{ sectionOrder: "asc" }, { specNumber: "asc" }, { name: "asc" }] },
          documents: true,
          hardware: { orderBy: [{ specNumber: "asc" }, { name: "asc" }] },
        },
      },
    },
  });

  if (!order) notFound();

  const statusCounts = order.products.flatMap((p) => p.parts).reduce(
    (acc, part) => {
      acc[part.status] = (acc[part.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <Link href="/orders" className="text-sm font-bold text-blue-700 hover:underline">
        ← К списку заказов
      </Link>

      <div className="mt-3 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Заказ {order.number}</h1>
          {order.title && <p className="font-medium text-black">{order.title}</p>}
          {order.notes && <p className="text-sm font-medium text-black mt-1">{order.notes}</p>}
        </div>
        <DeleteOrderButton orderId={order.id} orderNumber={order.number} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="rounded-xl bg-white border border-slate-200 p-3">
            <p className="text-sm font-medium text-black">
              {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
            </p>
            <p className="text-2xl font-bold text-black">{count}</p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <ExcelImport
          orderId={order.id}
          products={order.products.map((p) => ({ number: p.number, name: p.name }))}
        />
      </div>

      <div className="space-y-6">
        {order.products.map((product) => (
          <div key={product.id} className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-black mb-1">
              Изделие {product.number} — {product.name}
            </h2>
            <p className="text-sm font-medium text-black mb-4">
              {product.parts.length} деталей · {product.documents.length} документов
              {product.hardware.length > 0 && (
                <>
                  {" · "}
                  <Link
                    href={`/workflow/procurement/${order.id}`}
                    className="text-indigo-700 font-bold hover:underline"
                  >
                    {product.hardware.length} поз. фурнитуры → Закупка
                  </Link>
                </>
              )}
            </p>

            <p className="text-sm font-medium text-black mb-2">
              PDF: сборочный чертёж, деталировка, бирка
            </p>
            <div className="mb-4 space-y-4">
              <PdfPartsImport
                productId={product.id}
                productNumber={product.number}
                productName={product.name}
              />
              <DocumentUpload productId={product.id} />
            </div>

            {product.documents.length > 0 && (
              <DocumentList productId={product.id} documents={product.documents} />
            )}

            <ProductSpecification parts={product.parts} />
          </div>
        ))}
      </div>
    </div>
  );
}
