import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import AppShell from "@/components/AppShell";
import type { Prisma } from "@prisma/client";

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card">
      <div className="text-3xl font-semibold text-slate-800">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {hint && <div className="mt-2 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

// Scope appointments to the current user, mirroring the API.
function scope(role: string, userId: string, email: string): Prisma.AppointmentWhereInput {
  switch (role) {
    case "DOCTOR": return { doctorId: userId };
    case "NURSE": return { nurseId: userId };
    case "PATIENT": return { patient: { email } };
    default: return {};
  }
}

export default async function DashboardPage() {
  const user = await requireUser();
  const where = scope(user.role, user.userId, user.email);

  const now = new Date();
  const [total, pending, confirmed, done, upcoming] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: { ...where, status: "PENDING" } }),
    prisma.appointment.count({ where: { ...where, status: "CONFIRMED" } }),
    prisma.appointment.count({ where: { ...where, status: "DONE" } }),
    prisma.appointment.count({ where: { ...where, date: { gte: now }, status: { not: "DONE" } } }),
  ]);

  const patientsRegistered =
    user.role === "NURSE"
      ? await prisma.patient.count({ where: { createdById: user.userId } })
      : user.role === "ADMIN"
      ? await prisma.patient.count()
      : 0;

  const roleBlurb: Record<string, string> = {
    PATIENT: "Here are your upcoming appointments and reminders.",
    NURSE: "Register patients and book appointments for doctors.",
    DOCTOR: "Review, accept and complete your assigned appointments.",
    ADMIN: "Full overview of patients, staff, appointments and statistics.",
  };

  return (
    <AppShell name={user.name} role={user.role}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Welcome, {user.name}
        </h1>
        <p className="text-sm text-slate-500">
          {ROLE_LABELS[user.role]} · {roleBlurb[user.role]}
        </p>
      </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total appointments" value={total} />
          <StatCard label="Upcoming" value={upcoming} />
          <StatCard label="Pending" value={pending} />
          {user.role === "DOCTOR" || user.role === "PATIENT" ? (
            <StatCard label="Confirmed" value={confirmed} />
          ) : (
            <StatCard label="Completed" value={done} />
          )}
        </div>

        {(user.role === "NURSE" || user.role === "ADMIN") && (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Patients registered" value={patientsRegistered} />
            <StatCard label="Confirmed" value={confirmed} />
            <StatCard label="Completed" value={done} />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/appointments" className="btn-primary">
            View appointments
          </Link>
          {(user.role === "NURSE" || user.role === "ADMIN") && (
            <Link href="/patients/new" className="btn-ghost">
              Register a patient
            </Link>
          )}
          {user.role === "ADMIN" && (
            <Link href="/users" className="btn-ghost">
              Manage users
            </Link>
          )}
          {user.role === "ADMIN" && (
            <Link href="/stats" className="btn-ghost">
              View statistics
            </Link>
          )}
      </div>
    </AppShell>
  );
}
