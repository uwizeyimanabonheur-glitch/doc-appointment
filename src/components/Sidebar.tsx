"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS, canRegisterPatients, canViewStats } from "@/lib/roles";

export default function Sidebar({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links: { href: string; label: string; icon: string }[] = [
    { href: "/dashboard", label: "Dashboard", icon: "▤" },
    { href: "/appointments", label: "Appointments", icon: "🗓" },
  ];
  if (canRegisterPatients(role)) {
    links.push({ href: "/patients/new", label: "Register Patient", icon: "＋" });
  }
  if (role === "ADMIN") {
    links.push({ href: "/users", label: "Users", icon: "👥" });
  }
  if (canViewStats(role)) {
    links.push({ href: "/stats", label: "Statistics", icon: "📊" });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="text-lg font-semibold text-brand">Chronic Care</span>
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="btn-ghost px-2 py-1 text-lg leading-none"
        >
          ☰
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="text-lg font-semibold text-brand"
          >
            Chronic Care
          </Link>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="text-slate-400 md:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-brand/10 font-medium text-brand"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="w-5 text-center text-base">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-700">{name}</div>
              <div className="text-xs text-slate-400">{ROLE_LABELS[role]}</div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost w-full">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
