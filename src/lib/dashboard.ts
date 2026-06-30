import { PartStatus } from "@prisma/client";
import { prisma } from "./db";
import { STATUS_LABELS } from "./constants";

export const ALL_STATUSES: PartStatus[] = [
  "CREATED",
  "RECEIVED",
  "SORTED",
  "DRILLED",
  "QC_PASSED",
  "QC_FAILED",
  "PACKED",
];

export type DashboardData = {
  updatedAt: string;
  totals: Record<PartStatus, number>;
  totalParts: number;
  totalOrders: number;
  ordersWithoutParts: number;
  activeOrders: Array<{
    id: string;
    number: string;
    title: string | null;
    productCount: number;
    totalParts: number;
    byStatus: Record<PartStatus, number>;
    progressPercent: number;
  }>;
  recentActivity: Array<{
    id: string;
    partName: string;
    productName: string;
    productNumber: string;
    orderNumber: string;
    userName: string;
    action: string;
    toStatus: PartStatus | null;
    createdAt: string;
  }>;
};

export async function getDashboardData(): Promise<DashboardData> {
  const [parts, orders, recentHistory] = await Promise.all([
    prisma.part.findMany({
      select: { status: true, productId: true },
    }),
    prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        products: {
          include: {
            parts: { select: { status: true } },
            _count: { select: { parts: true } },
          },
        },
      },
    }),
    prisma.partHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        part: {
          include: {
            product: { include: { order: true } },
          },
        },
      },
    }),
  ]);

  const totals = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    PartStatus,
    number
  >;

  for (const part of parts) {
    totals[part.status]++;
  }

  type OrderRow = DashboardData["activeOrders"][number] & { hasActive: boolean };
  const orderRows: OrderRow[] = [];

  for (const order of orders) {
    const allParts = order.products.flatMap((p) => p.parts);
    const totalParts = allParts.length;
    if (totalParts === 0) continue;

    const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
      PartStatus,
      number
    >;
    for (const part of allParts) {
      byStatus[part.status]++;
    }

    const progressPercent = Math.round((byStatus.PACKED / totalParts) * 100);
    const hasActive = allParts.some((p) => p.status !== "PACKED");

    orderRows.push({
      id: order.id,
      number: order.number,
      title: order.title,
      productCount: order.products.length,
      totalParts,
      byStatus,
      progressPercent,
      hasActive,
    });
  }

  orderRows.sort((a, b) => {
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1;
    return b.progressPercent - a.progressPercent;
  });

  const activeOrders = orderRows.map(
    ({ hasActive: _, ...rest }) => rest,
  ) as DashboardData["activeOrders"];

  const ordersWithParts = orderRows.length;
  const ordersWithoutParts = orders.length - ordersWithParts;

  const recentActivity = recentHistory.map((h) => ({
    id: h.id,
    partName: h.part.name,
    productName: h.part.product.name,
    productNumber: h.part.product.number,
    orderNumber: h.part.product.order.number,
    userName: h.userName,
    action: h.toStatus ? STATUS_LABELS[h.toStatus] : h.action,
    toStatus: h.toStatus,
    createdAt: h.createdAt.toISOString(),
  }));

  return {
    updatedAt: new Date().toISOString(),
    totals,
    totalParts: parts.length,
    totalOrders: orders.length,
    ordersWithoutParts,
    activeOrders,
    recentActivity,
  };
}
