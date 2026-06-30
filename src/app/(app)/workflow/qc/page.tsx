import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { WorkflowPartList } from "@/components/WorkflowPartList";

export default async function QcPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "QC", "MANAGER"])) redirect("/login");

  const parts = await prisma.part.findMany({
    where: { status: "DRILLED" },
    include: {
      product: { include: { order: true } },
    },
    orderBy: [{ product: { order: { number: "asc" } } }, { name: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-2">ОКК — контроль качества</h1>
      <p className="font-medium text-black mb-6">Проверьте фото и качество присадки</p>
      <WorkflowPartList
        parts={parts}
        stage="qc"
        actionLabel="✓ ОК"
        nextStatus="QC_PASSED"
        allowReject
        rejectStatus="QC_FAILED"
      />
    </div>
  );
}
