import type { Role } from "@prisma/client";
import Sidebar from "./Sidebar";

// Shared authenticated layout: fixed left sidebar + scrollable content.
export default function AppShell({
  name,
  role,
  children,
}: {
  name: string;
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar name={name} role={role} />
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
