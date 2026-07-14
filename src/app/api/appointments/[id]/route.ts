import { NextResponse } from "next/server";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyOnConfirmation } from "@/lib/appointment-events";
import type { SessionPayload } from "@/lib/session";

const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, name: true, code: true, email: true, phone: true } },
  doctor: { select: { id: true, name: true } },
  nurse: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude;

const VALID_STATUS: AppointmentStatus[] = ["PENDING", "CONFIRMED", "DONE"];

type Appt = { nurseId: string; doctorId: string; status: AppointmentStatus };

// Who may modify this appointment, and how.
function canEdit(user: SessionPayload, appt: Appt): boolean {
  if (user.role === "ADMIN") return true;
  // Nurse: only her own, and only while still pending.
  if (user.role === "NURSE") {
    return appt.nurseId === user.userId && appt.status === "PENDING";
  }
  // Doctor: only appointments assigned to her.
  if (user.role === "DOCTOR") return appt.doctorId === user.userId;
  return false;
}

// GET /api/appointments/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: APPOINTMENT_INCLUDE,
  });
  if (!appointment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ appointment });
}

// PATCH /api/appointments/:id — update / accept / mark done.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(user, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    status?: AppointmentStatus;
    date?: string;
    doctorId?: string;
    reason?: string;
  };

  const data: Prisma.AppointmentUpdateInput = {};

  if (body.status) {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // A nurse cannot confirm/complete an appointment.
    if (user.role === "NURSE" && body.status !== "PENDING") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    data.status = body.status;
  }

  if (body.date) {
    const when = new Date(body.date);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    data.date = when;
    data.reminderSent = false; // re-arm reminder if the date changed
  }

  if (typeof body.reason === "string") data.reason = body.reason.trim() || null;

  if (body.doctorId && (user.role === "ADMIN")) {
    data.doctor = { connect: { id: body.doctorId } };
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data,
    include: APPOINTMENT_INCLUDE,
  });

  // Notify patient + nurse when an appointment becomes CONFIRMED.
  if (body.status === "CONFIRMED" && existing.status !== "CONFIRMED") {
    await notifyOnConfirmation(appointment.id);
  }

  return NextResponse.json({ appointment });
}

// DELETE /api/appointments/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(user, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.appointment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
