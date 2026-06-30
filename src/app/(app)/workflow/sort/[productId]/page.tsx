import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { SortProductGuide } from "@/components/SortProductGuide";

export default async function SortProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ poz?: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "SORTER", "MANAGER"])) redirect("/login");

  const { productId } = await params;
  const { poz } = await searchParams;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      order: true,
      parts: {
        where: { status: "RECEIVED" },
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
    <div className="w-full max-w-none">
      <Link href="/workflow/sort" className="text-sm text-blue-600 hover:underline">
        ← К сортировке
      </Link>

      <div className="mt-4">
      <SortProductGuide
        productId={product.id}
        productNumber={product.number}
        productName={product.name}
        orderNumber={product.order.number}
        parts={parts}
        initialQuery={poz?.trim() ?? ""}
      />
      </div>
    </div>
  );
}
