import { PrismaClient, Role, AppointmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Demo password for every seeded account. Change after first login.
const DEMO_PASSWORD = "password123";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding database...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Alice Admin",
      email: "admin@example.com",
      phone: "0788888888",
      role: Role.ADMIN,
      password: DEMO_PASSWORD,
    },
  });

  const nurse = await prisma.user.upsert({
    where: { email: "nurse@example.com" },
    update: {},
    create: {
      name: "Nina Nurse",
      email: "nurse@example.com",
      phone: "0788888889",
      role: Role.NURSE,
      password: DEMO_PASSWORD,
    },
  });

  const doctor = await prisma.user.upsert({
    where: { email: "doctor@example.com" },
    update: {},
    create: {
      name: "Dr. David",
      email: "doctor@example.com",
      phone: "0788888891",
      role: Role.DOCTOR,
      password: DEMO_PASSWORD,
    },
  });

  // A patient is also a User (role PATIENT) so they can log in and see
  // their own appointments, plus a Patient record holding the clinical code.
  const patientUser = await prisma.user.upsert({
    where: { email: "patient@example.com" },
    update: {},
    create: {
      name: "Paul Patient",
      email: "patient@example.com",
      phone: "0788888890",
      role: Role.PATIENT,
      password: DEMO_PASSWORD,
    },
  });

  const patient = await prisma.patient.upsert({
    where: { code: "PT-0001" },
    update: {},
    create: {
      code: "PT-0001",
      name: "Paul Patient",
      email: "patient@example.com",
      phone: "0788888890",
      createdById: nurse.id,
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      nurseId: nurse.id,
      status: AppointmentStatus.PENDING,
      date: daysFromNow(1),
      reason: "Routine diabetes check-up",
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      nurseId: nurse.id,
      status: AppointmentStatus.CONFIRMED,
      date: daysFromNow(7),
      reason: "Blood pressure follow-up",
    },
  });

  console.log("Seed complete.");
  console.log("Login with any of these (password: %s):", DEMO_PASSWORD);
  console.log(" - admin@example.com   (ADMIN)");
  console.log(" - nurse@example.com   (NURSE)");
  console.log(" - doctor@example.com  (DOCTOR)");
  console.log(" - patient@example.com (PATIENT)");
  void admin;
  void patientUser;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
