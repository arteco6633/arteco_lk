import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { getSession } from "@/lib/session";
import { WORKFLOW_LINKS, ROLE_LABELS, canAccess, homeForRole } from "@/lib/constants";
import type { Role } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const navLinks = [
    ...(session.role === "ADMIN"
      ? [{ href: "/admin", label: "Дашборд" }]
      : []),
    ...(session.role === "ADMIN" || session.role === "MANAGER"
      ? [
          { href: "/orders", label: "Заказы" },
          { href: "/workflow/procurement", label: "Закупка" },
        ]
      : []),
    ...WORKFLOW_LINKS.filter((link) => canAccess(session.role, link.roles)),
  ];

  const roleLabel = ROLE_LABELS[session.role as Role];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href={homeForRole(session.role)} className="text-lg font-bold text-black">
              Mebel Flow
            </Link>
            <p className="text-sm font-medium text-slate-600">
              {session.name}
              {session.name !== roleLabel ? ` · ${roleLabel}` : ""}
            </p>
          </div>
          <AppNav links={navLinks} />
        </div>
      </header>
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
