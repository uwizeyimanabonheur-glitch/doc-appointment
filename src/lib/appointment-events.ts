import { prisma } from "./prisma";
import { notify } from "./notifications";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type AppointmentWithParties = {
  id: string;
  date: Date;
  patient: { name: string; email: string | null; phone: string | null };
  doctor: { name: string; email: string | null; phone: string | null };
  nurse: { name: string; email: string | null; phone: string | null };
};

function fmt(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function loadAppointmentParties(
  id: string,
): Promise<AppointmentWithParties | null> {
  return prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      patient: { select: { name: true, email: true, phone: true } },
      doctor: { select: { name: true, email: true, phone: true } },
      nurse: { select: { name: true, email: true, phone: true } },
    },
  });
}

// Nurse books -> Doctor notified (email + SMS).
export async function notifyOnBooking(id: string) {
  const appt = await loadAppointmentParties(id);
  if (!appt) return;
  const message =
    `New appointment booked by ${appt.nurse.name}.\n` +
    `Patient: ${appt.patient.name}\n` +
    `When: ${fmt(appt.date)}\n` +
    `Please review it here: ${APP_URL}/appointments`;
  await notify({
    email: appt.doctor.email,
    phone: appt.doctor.phone,
    subject: "New appointment to review",
    message,
  });
}

// Doctor accepts -> Patient + Nurse notified.
export async function notifyOnConfirmation(id: string) {
  const appt = await loadAppointmentParties(id);
  if (!appt) return;
  const message =
    `Appointment confirmed with ${appt.doctor.name}.\n` +
    `Patient: ${appt.patient.name}\n` +
    `When: ${fmt(appt.date)}`;
  await Promise.all([
    notify({
      email: appt.patient.email,
      phone: appt.patient.phone,
      subject: "Your appointment is confirmed",
      message,
    }),
    notify({
      email: appt.nurse.email,
      phone: appt.nurse.phone,
      subject: "Appointment confirmed by doctor",
      message,
    }),
  ]);
}

// Reminder X days before -> Patient + Doctor notified.
export async function notifyReminder(id: string) {
  const appt = await loadAppointmentParties(id);
  if (!appt) return;
  const message =
    `Reminder: appointment on ${fmt(appt.date)}.\n` +
    `Patient: ${appt.patient.name}\n` +
    `Doctor: ${appt.doctor.name}`;
  await Promise.all([
    notify({
      email: appt.patient.email,
      phone: appt.patient.phone,
      subject: "Appointment reminder",
      message,
    }),
    notify({
      email: appt.doctor.email,
      phone: appt.doctor.phone,
      subject: "Appointment reminder",
      message,
    }),
  ]);
}
