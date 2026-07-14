import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canBookAppointments } from "@/lib/roles";
import { notifyOnBooking } from "@/lib/appointment-events";

const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, name: true, code: true, email: true, phone: true } },
  doctor: { select: { id: true, name: true } },
  nurse: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude;

// Build the where-clause that scopes appointments to the caller's role.
function scopeForUser(user: {
  userId: string;
  role: string;
  email: string;
}): Prisma.AppointmentWhereInput {
  switch (user.role) {
    case "DOCTOR":
      return { doctorId: user.userId };
    case "NURSE":
      return { nurseId: user.userId };
    case "PATIENT":
      // Patient records are linked to the login by email.
      return { patient: { email: user.email } };
    case "ADMIN":
    default:
      return {};
  }
}

// GET /api/appointments — role-filtered list.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appointments = await prisma.appointment.findMany({
    where: scopeForUser(user),
    orderBy: { date: "asc" },
    include: APPOINTMENT_INCLUDE,
  });
  return NextResponse.json({ appointments });
}

// POST /api/appointments — book an appointment (Nurse/Admin).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canBookAppointments(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { patientId, doctorId, date, reason } = (await req.json()) as {
    patientId?: string;
    doctorId?: string;
    date?: string;
    reason?: string;
  };

  if (!patientId || !doctorId || !date) {
    return NextResponse.json(
      { error: "patientId, doctorId and date are required" },
      { status: 400 },
    );
  }

  const when = new Date(date);
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      nurseId: user.userId,
      date: when,
      reason: reason?.trim() || null,
      status: "PENDING",
    },
    include: APPOINTMENT_INCLUDE,
  });

  // Fire-and-forget: notify the doctor. Errors are swallowed by notify().
  await notifyOnBooking(appointment.id);

  return NextResponse.json({ appointment }, { status: 201 });
}
