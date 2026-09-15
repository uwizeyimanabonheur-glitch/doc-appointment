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
    `Dear Dr. ${appt.doctor.name},\n\n` +
    `A new appointment has been booked and requires your review.` +
    `\n\nPatient: ${appt.patient.name}\n` +
    `Patient contact: ${appt.patient.email ?? "(no email)"} | ${appt.patient.phone ?? "(no phone)"}\n` +
    `Booked by: ${appt.nurse.name} ${appt.nurse.email ? `<${appt.nurse.email}>` : ""} ${appt.nurse.phone ? `(${appt.nurse.phone})` : ""}\n\n` +
    `Appointment time: ${fmt(appt.date)}\n` +
    `Appointment ID: ${appt.id}\n\n` +
    `Please review and take one of the following actions:` +
    `\n- Confirm the appointment if the time is suitable.` +
    `\n- Propose an alternative time if you need to reschedule.` +
    `\n- Contact the booking nurse for additional details.` +
    `\n\nYou can view and manage this appointment here:` +
    `\n${APP_URL}/appointments/${appt.id}\n\n` +
    `Thank you,\nChronic Care Scheduler`;

  const html = `
    <p>Dear Dr. ${appt.doctor.name},</p>
    <p>A new appointment has been <strong>booked</strong> and requires your review.</p>
    <h3>Appointment details</h3>
    <ul>
      <li><strong>Patient:</strong> ${appt.patient.name}</li>
      <li><strong>Contact:</strong> ${appt.patient.email ?? "(no email)"} | ${appt.patient.phone ?? "(no phone)"}</li>
      <li><strong>Booked by:</strong> ${appt.nurse.name} ${appt.nurse.email ? `&lt;${appt.nurse.email}&gt;` : ""} ${appt.nurse.phone ? `(${appt.nurse.phone})` : ""}</li>
      <li><strong>When:</strong> ${fmt(appt.date)}</li>
      <li><strong>Appointment ID:</strong> ${appt.id}</li>
    </ul>
    <p>Please review and take one of the following actions:</p>
    <ul>
      <li>Confirm the appointment if the time is suitable.</li>
      <li>Propose an alternative time to reschedule.</li>
      <li>Contact the booking nurse for additional details.</li>
    </ul>
    <p><a href="${APP_URL}/appointments/${appt.id}">View and manage this appointment</a></p>
    <p>Thank you,<br/>Chronic Care Scheduler</p>
  `;

  await notify({
    email: appt.doctor.email,
    phone: appt.doctor.phone,
    subject: `New appointment requires review — ${fmt(appt.date)}`,
    message,
    html,
  });
}

// Doctor accepts -> Patient + Nurse notified.
export async function notifyOnConfirmation(id: string) {
  const appt = await loadAppointmentParties(id);
  if (!appt) return;
  console.log("Sending email to this user:", appt.patient.email, appt.nurse.email);
  const patientMessage =
    `Dear ${appt.patient.name},\n\n` +
    `Your appointment with ${appt.doctor.name} has been confirmed.` +
    `\n\nWhen: ${fmt(appt.date)}\n` +
    `Appointment ID: ${appt.id}\n\n` +
    `If you need to cancel or reschedule, please contact your care team as soon as possible.` +
    `\n\nYou can view the appointment details here:` +
    `\n${APP_URL}/appointments/${appt.id}\n\n` +
    `We look forward to seeing you.\n\nBest regards,\nChronic Care Scheduler`;

  const patientHtml = `
    <p>Dear ${appt.patient.name},</p>
    <p>Your appointment with <strong>${appt.doctor.name}</strong> has been <strong>confirmed</strong>.</p>
    <p><strong>When:</strong> ${fmt(appt.date)}<br/>
    <strong>Appointment ID:</strong> ${appt.id}</p>
    <p>If you need to cancel or reschedule, please contact your care team as soon as possible.</p>
    <p><a href="${APP_URL}/appointments/${appt.id}">View appointment details</a></p>
    <p>We look forward to seeing you.<br/>Best regards,<br/>Chronic Care Scheduler</p>
  `;

  const nurseMessage =
    `Hello ${appt.nurse.name},\n\n` +
    `The appointment you booked for ${appt.patient.name} has been confirmed by ${appt.doctor.name}.` +
    `\n\nWhen: ${fmt(appt.date)}\n` +
    `Appointment ID: ${appt.id}\n\n` +
    `No further action is required unless you need to follow up with the patient.` +
    `\n\nThank you for coordinating care.\nChronic Care Scheduler`;

  const nurseHtml = `
    <p>Hello ${appt.nurse.name},</p>
    <p>The appointment you booked for <strong>${appt.patient.name}</strong> has been confirmed by <strong>${appt.doctor.name}</strong>.</p>
    <p><strong>When:</strong> ${fmt(appt.date)}<br/>
    <strong>Appointment ID:</strong> ${appt.id}</p>
    <p>No further action is required unless you need to follow up with the patient.</p>
    <p>Thank you for coordinating care.<br/>Chronic Care Scheduler</p>
  `;

  await Promise.all([
    notify({
      email: appt.patient.email,
      phone: appt.patient.phone,
      subject: `Appointment confirmed — ${fmt(appt.date)}`,
      message: patientMessage,
      html: patientHtml,
    }),
    notify({
      email: appt.nurse.email,
      phone: appt.nurse.phone,
      subject: `Appointment confirmed by ${appt.doctor.name}`,
      message: nurseMessage,
      html: nurseHtml,
    }),
  ]);
}

// Reminder X days before -> Patient + Doctor notified.
export async function notifyReminder(id: string) {
  const appt = await loadAppointmentParties(id);
  if (!appt) return;
  const message =
    `Hello ${appt.patient.name},\n\n` +
    `This is a friendly reminder of your upcoming appointment with ${appt.doctor.name}.` +
    `\n\nWhen: ${fmt(appt.date)}\n` +
    `Appointment ID: ${appt.id}\n\n` +
    `Please arrive 10–15 minutes early to allow time for check-in. If you need to cancel or reschedule,` +
    ` contact us or use the appointment link below at your earliest convenience.` +
    `\n\nAppointment details: ${APP_URL}/appointments/${appt.id}\n\n` +
    `Thank you,\nChronic Care Scheduler`;

  const patientHtml = `
    <p>Hello ${appt.patient.name},</p>
    <p>This is a friendly reminder of your upcoming appointment with <strong>${appt.doctor.name}</strong>.</p>
    <p><strong>When:</strong> ${fmt(appt.date)}<br/>
    <strong>Appointment ID:</strong> ${appt.id}</p>
    <p>Please arrive 10–15 minutes early to allow time for check-in. If you need to cancel or reschedule, contact us or use the appointment link below.</p>
    <p><a href="${APP_URL}/appointments/${appt.id}">View appointment details</a></p>
    <p>Thank you,<br/>Chronic Care Scheduler</p>
  `;

  const doctorMessage =
    `Hello ${appt.doctor.name},\n\n` +
    `Reminder: you have an upcoming appointment with ${appt.patient.name}.` +
    `\n\nWhen: ${fmt(appt.date)}\n` +
    `Appointment ID: ${appt.id}\n\n` +
    `Please review the patient's record ahead of the visit if needed.` +
    `\n\nDetails: ${APP_URL}/appointments/${appt.id}\n\n` +
    `Best regards,\nChronic Care Scheduler`;

  const doctorHtml = `
    <p>Hello ${appt.doctor.name},</p>
    <p>Reminder: you have an upcoming appointment with <strong>${appt.patient.name}</strong>.</p>
    <p><strong>When:</strong> ${fmt(appt.date)}<br/>
    <strong>Appointment ID:</strong> ${appt.id}</p>
    <p>Please review the patient's record ahead of the visit if needed.</p>
    <p><a href="${APP_URL}/appointments/${appt.id}">View appointment details</a></p>
    <p>Best regards,<br/>Chronic Care Scheduler</p>
  `;

  await Promise.all([
    notify({
      email: appt.patient.email,
      phone: appt.patient.phone,
      subject: `Appointment reminder — ${fmt(appt.date)}`,
      message,
      html: patientHtml,
    }),
    notify({
      email: appt.doctor.email,
      phone: appt.doctor.phone,
      subject: `Upcoming appointment with ${appt.patient.name} — ${fmt(appt.date)}`,
      message: doctorMessage,
      html: doctorHtml,
    }),
  ]);
}
