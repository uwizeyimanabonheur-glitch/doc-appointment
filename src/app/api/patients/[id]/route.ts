import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function canManagePatient(user: Awaited<ReturnType<typeof getCurrentUser>>, patientId: string) {
    if (!user) return { ok: false, status: 401, error: "Unauthorized" } as const;
    if (user.role !== "ADMIN" && user.role !== "NURSE") {
        return { ok: false, status: 403, error: "Forbidden" } as const;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
        return { ok: false, status: 404, error: "Not found" } as const;
    }

    if (user.role === "NURSE" && patient.createdById !== user.userId) {
        return { ok: false, status: 403, error: "Forbidden" } as const;
    }

    return { ok: true, patient } as const;
}

// PATCH /api/patients/:id — update a patient (Admin can update any; Nurse only own)
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = await getCurrentUser();
    const permission = await canManagePatient(user, id);
    if (!permission.ok) {
        return NextResponse.json({ error: permission.error }, { status: permission.status });
    }

    const body = (await req.json()) as {
        name?: string;
        email?: string | null;
        phone?: string | null;
    };

    if (typeof body.name === "string" && !body.name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const data: {
        name?: string;
        email?: string | null;
        phone?: string | null;
    } = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.email !== undefined) data.email = body.email?.trim() ? body.email.trim() : null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() ? body.phone.trim() : null;

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const patient = await prisma.patient.update({
        where: { id },
        data,
    });

    return NextResponse.json({ patient });
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    return PATCH(req, { params });
}

// DELETE /api/patients/:id — remove a patient (Admin can remove any; Nurse only own)
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role !== "ADMIN" && user.role !== "NURSE") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Nurses may only delete patients they created.
    if (user.role === "NURSE" && existing.createdById !== user.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.patient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
