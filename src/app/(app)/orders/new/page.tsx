import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { NewOrderForm } from "@/components/NewOrderForm";

export default async function NewOrderPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, ["ADMIN", "MANAGER"])) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-6">Новый заказ</h1>
      <NewOrderForm />
    </div>
  );
}
