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
  const [statusGroups, orders, recentHistory, totalParts] = await Promise.all([
    prisma.part.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        products: {
          select: {
            parts: { select: { status: true } },
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
    prisma.part.count(),
  ]);

  const totals = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    PartStatus,
    number
  >;

  for (const row of statusGroups) {
    totals[row.status] = row._count._all;
  }

  type OrderRow = DashboardData["activeOrders"][number] & { hasActive: boolean };
  const orderRows: OrderRow[] = [];

  for (const order of orders) {
    const allParts = order.products.flatMap((p) => p.parts);
    const partCount = allParts.length;
    if (partCount === 0) continue;

    const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
      PartStatus,
      number
    >;
    for (const part of allParts) {
      byStatus[part.status]++;
    }

    const progressPercent = Math.round((byStatus.PACKED / partCount) * 100);
    const hasActive = allParts.some((p) => p.status !== "PACKED");

    orderRows.push({
      id: order.id,
      number: order.number,
      title: order.title,
      productCount: order.products.length,
      totalParts: partCount,
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
    totalParts,
    totalOrders: orders.length,
    ordersWithoutParts,
    activeOrders,
    recentActivity,
  };
}
