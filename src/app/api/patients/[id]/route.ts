import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
