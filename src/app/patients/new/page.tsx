import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import PatientForm from "./PatientForm";

export default async function NewPatientPage() {
  const user = await requireRole(["NURSE", "ADMIN"]);

  const patients = await prisma.patient.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <AppShell name={user.name} role={user.role}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Register Patient</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create a patient record. A unique patient code is generated automatically.
      </p>

      <div className="grid gap-8 md:grid-cols-2">
        <PatientForm />

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently registered
          </h2>
          <ul className="space-y-2">
            {patients.length === 0 && (
              <li className="text-sm text-slate-400">No patients yet.</li>
            )}
            {patients.map((p) => (
              <li key={p.id} className="card flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-slate-700">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    {p.email || "no email"} · {p.phone || "no phone"}
                  </div>
                </div>
                <span className="badge bg-brand/10 text-brand">{p.code}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
