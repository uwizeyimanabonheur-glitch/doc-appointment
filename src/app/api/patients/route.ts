import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canRegisterPatients } from "@/lib/roles";

// GET /api/patients — list patients, or search by code with ?code=.
// A code search matches across ALL patients (so a nurse can book for any
// patient by code); the plain list stays scoped (Nurse: own, Admin: all).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRegisterPatients(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = new URL(req.url).searchParams.get("code")?.trim();

  if (code) {
    const patients = await prisma.patient.findMany({
      where: { code: { contains: code, mode: "insensitive" } },
      orderBy: { code: "asc" },
      take: 10,
      select: { id: true, name: true, code: true, email: true, phone: true },
    });
    return NextResponse.json({ patients });
  }

  const patients = await prisma.patient.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.userId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return NextResponse.json({ patients });
}

// Generate a short unique patient code like PT-4F9A2B.
function generateCode(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PT-${rand}`;
}

// POST /api/patients — register a new patient (Nurse/Admin only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRegisterPatients(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, phone } = (await req.json()) as {
    name?: string;
    email?: string;
    phone?: string;
  };
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Retry a couple of times in the unlikely event of a code collision.
  let patient = null;
  for (let attempt = 0; attempt < 5 && !patient; attempt++) {
    try {
      patient = await prisma.patient.create({
        data: {
          code: generateCode(),
          name: name.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          createdById: user.userId,
        },
      });
    } catch (err) {
      // Unique constraint on code — try again with a new code.
      if (attempt === 4) throw err;
    }
  }

  return NextResponse.json({ patient }, { status: 201 });
}
