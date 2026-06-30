import { OrderStatus } from "@prisma/client";
import { prisma } from "./db";

/** Пересчитывает статус заказа по фурнитуре и деталям */
export async function syncOrderStatus(orderId: string): Promise<OrderStatus> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      products: {
        include: {
          parts: { select: { status: true } },
          hardware: { select: { purchased: true } },
        },
      },
    },
  });

  if (!order) return "NEW";

  const parts = order.products.flatMap((p) => p.parts);
  const hardware = order.products.flatMap((p) => p.hardware);

  let status: OrderStatus = "NEW";

  if (hardware.length > 0 && hardware.some((h) => !h.purchased)) {
    status = "PROCUREMENT";
  } else if (parts.length > 0) {
    status = parts.every((p) => p.status === "PACKED") ? "COMPLETED" : "PRODUCTION";
  }

  if (order.status !== "CANCELLED" && order.status !== status) {
    await prisma.order.update({ where: { id: orderId }, data: { status } });
  }

  return status;
}
