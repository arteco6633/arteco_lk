"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

type NavLink = { href: string; label: string };

export function AppNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/orders") return pathname.startsWith("/orders");
    if (href === "/catalog") return pathname.startsWith("/catalog");
    if (href === "/workflow/procurement") return pathname.startsWith("/workflow/procurement");
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-wrap items-center gap-1.5">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-black hover:bg-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <LogoutButton />
    </nav>
  );
}
