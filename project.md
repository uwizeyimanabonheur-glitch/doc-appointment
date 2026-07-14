Coding Prompt: Intelligent System for Scheduling & Reminders in Chronic Disease Patient Care
Project Goal:  
Build a simple, role-based web application for managing patient appointments, notifications, and reminders in chronic disease care. The app should have very few pages, but each page must dynamically adapt based on user role (Patient, Nurse, Doctor, Admin).

🔧 Tech Stack
Backend: Next.js (API routes, server-side logic)

Frontend: Next.js (React components, role-based UI)

Database: Vercel-Prisma (Postgres schema, migrations)

Scheduler: Vercel Cron Jobs (appointment reminders)

Mailing: Web3Forms (email notifications)

SMS: ClickSend (SMS notifications)

👥 Roles & Permissions
Patient

View appointments

Receive notifications (email + SMS)

Nurse

Create patient records

Book appointments (grouped per doctor)

Update/delete pending appointments (before doctor accepts)

View appointments she created

Doctor

View assigned appointments

Accept/update appointments

Mark appointment as done

Receive notifications

Admin

Full CRUD on Patients, Nurses, Doctors, Appointments

View all appointments (with creator info)

Access statistics (appointments per doctor/nurse, completion rates, patient activity)

📑 Core Pages
Login / Role-based Dashboard

Single entry point, UI adapts based on role.

Appointments Page

Dynamic table: filters by role (Patient sees own, Nurse sees created, Doctor sees assigned, Admin sees all).

Patient Registration Page (Nurse/Admin only)

Simple form → generates patient code.

Notifications

Triggered via backend logic (email via Web3Forms, SMS via ClickSend).

Admin Stats Page

Charts: appointments per doctor, nurse workload, patient attendance.

🗄️ Database Schema (Prisma)
prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  role      Role
  patients  Patient[]
  createdAt DateTime @default(now())
}

model Patient {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  appointments Appointment[]
}

model Appointment {
  id          String   @id @default(uuid())
  patientId   String
  doctorId    String
  nurseId     String
  status      AppointmentStatus
  date        DateTime
  createdAt   DateTime @default(now())
}

enum Role {
  PATIENT
  NURSE
  DOCTOR
  ADMIN
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  DONE
}
🔔 Notification Flow
On booking: Nurse books → Doctor notified (email + SMS).

On confirmation: Doctor accepts → Patient + Nurse notified.

Reminder: Vercel Cron Jobs trigger reminders X days before appointment → Patient + Doctor notified.

📊 Admin Statistics
Total appointments per doctor

Pending vs confirmed vs done

Nurse workload (appointments created)

Patient attendance rate

🚀 Deliverables
Role-based dashboards with minimal pages

CRUD flows for Patients, Appointments, Users

Notifications integrated (Web3Forms + ClickSend)

Automated reminders via Vercel Cron Jobs

Prisma schema + migrations

Simple charts for Admin stats