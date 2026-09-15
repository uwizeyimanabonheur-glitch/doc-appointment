import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import PatientForm from "./PatientForm";
import PatientsClient from "../PatientsClient";

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

        <PatientsClient
          initialRows={patients.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            code: p.code,
            createdByName: p.createdBy?.name || null,
          }))}
          currentUserId={user.userId}
        />
      </div>
    </AppShell>
  );
}
