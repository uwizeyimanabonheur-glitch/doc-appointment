import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/stats — aggregate statistics (Admin only).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [byStatus, byDoctor, byNurse, totals] = await Promise.all([
    prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["doctorId"], _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["nurseId"], _count: { _all: true } }),
    prisma.$transaction([
      prisma.appointment.count(),
      prisma.patient.count(),
      prisma.user.count(),
    ]),
  ]);

  // Resolve doctor / nurse names.
  const userIds = Array.from(
    new Set([...byDoctor.map((d) => d.doctorId), ...byNurse.map((n) => n.nurseId)]),
  );
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  const statusCounts = { PENDING: 0, CONFIRMED: 0, DONE: 0 };
  for (const row of byStatus) {
    statusCounts[row.status] = row._count._all;
  }

  const totalAppointments = totals[0];
  const doneCount = statusCounts.DONE;
  const attendanceRate =
    totalAppointments > 0 ? Math.round((doneCount / totalAppointments) * 100) : 0;

  return NextResponse.json({
    totals: {
      appointments: totalAppointments,
      patients: totals[1],
      users: totals[2],
      attendanceRate,
    },
    statusCounts,
    perDoctor: byDoctor
      .map((d) => ({ name: nameOf(d.doctorId), count: d._count._all }))
      .sort((a, b) => b.count - a.count),
    perNurse: byNurse
      .map((n) => ({ name: nameOf(n.nurseId), count: n._count._all }))
      .sort((a, b) => b.count - a.count),
  });
}
