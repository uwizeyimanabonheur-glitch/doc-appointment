import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const user = await requireRole(["ADMIN"]);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <AppShell name={user.name} role={user.role}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Users & Staff</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create and manage patients, nurses, doctors and admins.
      </p>
      <UsersClient initialRows={rows} currentUserId={user.userId} />
    </AppShell>
  );
}
