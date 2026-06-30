import { PartStatus } from "@prisma/client";
import { prisma } from "./db";
import { syncOrderStatus } from "./orders";
import type { SessionUser } from "./session";

type TransitionOptions = {
  partId: string;
  user: SessionUser;
  toStatus: PartStatus;
  comment?: string;
  drillPhotoPath?: string;
};

export async function transitionPartStatus({
  partId,
  user,
  toStatus,
  comment,
  drillPhotoPath,
}: TransitionOptions) {
  const part = await prisma.part.findUnique({
    where: { id: partId },
    include: { product: { include: { order: true } } },
  });
  if (!part) throw new Error("Деталь не найдена");

  const now = new Date();
  const data: Record<string, unknown> = { status: toStatus };

  if (toStatus === "RECEIVED") data.receivedAt = now;
  if (toStatus === "SORTED") data.sortedAt = now;
  if (toStatus === "DRILLED") {
    data.drilledAt = now;
    if (drillPhotoPath) data.drillPhotoPath = drillPhotoPath;
  }
  if (toStatus === "QC_PASSED" || toStatus === "QC_FAILED") {
    data.qcAt = now;
    if (comment) data.qcComment = comment;
  }
  if (toStatus === "PACKED") data.packedAt = now;

  const updated = await prisma.part.update({
    where: { id: partId },
    data,
  });

  await prisma.partHistory.create({
    data: {
      partId,
      userId: user.id,
      userName: user.name,
      action: `Статус: ${part.status} → ${toStatus}`,
      fromStatus: part.status,
      toStatus,
      comment,
    },
  });

  await syncOrderStatus(part.product.orderId);

  return updated;
}

export const WORKFLOW_FILTERS: Record<string, PartStatus | PartStatus[]> = {
  receipt: "CREATED",
  sort: "RECEIVED",
  drill: "SORTED",
  qc: "DRILLED",
  pack: "QC_PASSED",
};
