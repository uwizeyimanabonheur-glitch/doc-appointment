import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

// GET /api/users — list users.
// Admin: all users. Nurse: may list DOCTORs only (to pick one when booking).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleFilter = new URL(req.url).searchParams.get("role") as Role | null;

  if (user.role !== "ADMIN") {
    if ((user.role === "NURSE" || user.role === "DOCTOR") && roleFilter === "DOCTOR") {
      const doctors = await prisma.user.findMany({
        where: { role: "DOCTOR" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ users: doctors });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : {},
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

// POST /api/users — create a user (Admin only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, phone, role, password } = (await req.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: Role;
    password?: string;
  };

  if (!name || !email || !role) {
    return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      role,
      password: password?.trim() || "password123",
    },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  return NextResponse.json({ user: created }, { status: 201 });
}
