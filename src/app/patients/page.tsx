import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import PatientsTableClient from "./PatientsTableClient";

export default async function PatientsPage() {
    const user = await requireRole(["NURSE", "ADMIN"]);

    const patients = await prisma.patient.findMany({
        where: user.role === "ADMIN" ? {} : { createdById: user.userId },
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
    });

    const rows = patients.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        code: p.code,
        createdByName: p.createdBy?.name || null,
        createdAt: p.createdAt.toISOString(),
    }));

    return (
        <AppShell name={user.name} role={user.role}>
            <h1 className="mb-1 text-2xl font-semibold text-slate-800">Patients</h1>
            <p className="mb-6 text-sm text-slate-500">Search, filter and manage patient records.</p>
            <PatientsTableClient initialRows={rows} currentUserId={user.userId} />
        </AppShell>
    );
}
