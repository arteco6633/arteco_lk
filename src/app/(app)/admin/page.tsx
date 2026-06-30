import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminDashboard } from "@/components/AdminDashboard";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Дашборд</h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Прогресс производства по всем заказам в реальном времени
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
