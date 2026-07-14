import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canBookAppointments } from "@/lib/roles";
import AppShell from "@/components/AppShell";
import AppointmentsClient from "./AppointmentsClient";
import type { Prisma } from "@prisma/client";

function scope(role: string, userId: string, email: string): Prisma.AppointmentWhereInput {
  switch (role) {
    case "DOCTOR": return { doctorId: userId };
    case "NURSE": return { nurseId: userId };
    case "PATIENT": return { patient: { email } };
    default: return {};
  }
}

export default async function AppointmentsPage() {
  const user = await requireUser();
  const canBook = canBookAppointments(user.role);

  const [appointments, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: scope(user.role, user.userId, user.email),
      orderBy: { date: "asc" },
      include: {
        patient: { select: { id: true, name: true, code: true } },
        doctor: { select: { id: true, name: true } },
        nurse: { select: { id: true, name: true } },
      },
    }),
    canBook
      ? prisma.user.findMany({
          where: { role: "DOCTOR" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Serialize dates for the client component.
  const rows = appointments.map((a) => ({
    id: a.id,
    date: a.date.toISOString(),
    status: a.status,
    reason: a.reason,
    patient: a.patient,
    doctor: a.doctor,
    nurse: a.nurse,
  }));

  return (
    <AppShell name={user.name} role={user.role}>
      <AppointmentsClient
        role={user.role}
        currentUserId={user.userId}
        initialRows={rows}
        doctors={doctors}
      />
    </AppShell>
  );
}
