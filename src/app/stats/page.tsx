import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import StatsCharts from "./StatsCharts";
import { prisma } from "@/lib/prisma";

export default async function StatsPage() {
  const user = await requireRole(["ADMIN"]);

  // Compute the same aggregates the /api/stats route returns, server-side.
  const [byStatus, byDoctor, byNurse, totalAppointments, totalPatients, totalUsers] =
    await Promise.all([
      prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ["doctorId"], _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ["nurseId"], _count: { _all: true } }),
      prisma.appointment.count(),
      prisma.patient.count(),
      prisma.user.count(),
    ]);

  const ids = Array.from(
    new Set([...byDoctor.map((d) => d.doctorId), ...byNurse.map((n) => n.nurseId)]),
  );
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  const statusCounts = { PENDING: 0, CONFIRMED: 0, DONE: 0 };
  for (const r of byStatus) statusCounts[r.status] = r._count._all;

  const attendanceRate =
    totalAppointments > 0 ? Math.round((statusCounts.DONE / totalAppointments) * 100) : 0;

  const perDoctor = byDoctor
    .map((d) => ({ name: nameOf(d.doctorId), count: d._count._all }))
    .sort((a, b) => b.count - a.count);
  const perNurse = byNurse
    .map((n) => ({ name: nameOf(n.nurseId), count: n._count._all }))
    .sort((a, b) => b.count - a.count);

  return (
    <AppShell name={user.name} role={user.role}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Statistics</h1>
      <p className="mb-6 text-sm text-slate-500">
        Appointments per doctor, nurse workload and patient attendance.
      </p>

      <StatsCharts
        totals={{
          appointments: totalAppointments,
          patients: totalPatients,
          users: totalUsers,
          attendanceRate,
        }}
        statusCounts={statusCounts}
        perDoctor={perDoctor}
        perNurse={perNurse}
      />
    </AppShell>
  );
}
