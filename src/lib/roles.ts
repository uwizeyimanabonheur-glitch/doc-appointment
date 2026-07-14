import type { Role } from "@prisma/client";

export const ROLES: Role[] = ["PATIENT", "NURSE", "DOCTOR", "ADMIN"];

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: "Patient",
  NURSE: "Nurse",
  DOCTOR: "Doctor",
  ADMIN: "Admin",
};

export function canRegisterPatients(role: Role): boolean {
  return role === "NURSE" || role === "ADMIN";
}

export function canViewStats(role: Role): boolean {
  return role === "ADMIN";
}

export function canBookAppointments(role: Role): boolean {
  return role === "NURSE" || role === "ADMIN";
}
