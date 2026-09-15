import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusBadge from "@/components/StatusBadge";

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
    }).format(date);
}

const STATUS_COPY: Record<"PENDING" | "CONFIRMED" | "DONE", string> = {
    PENDING: "This appointment is still pending confirmation from the doctor.",
    CONFIRMED: "This appointment has been confirmed and is scheduled.",
    DONE: "This appointment has been completed.",
};

export default async function AppointmentStatusPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
            patient: true,
            doctor: true,
            nurse: true,
        },
    });

    if (!appointment) {
        notFound();
    }

    const statusText = STATUS_COPY[appointment.status];

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-10">
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Appointment status
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h1 className="text-2xl font-semibold text-slate-800">
                            {appointment.patient.name}
                        </h1>
                        <StatusBadge status={appointment.status} />
                    </div>
                </div>

                <div className="space-y-6 px-6 py-6">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Current status</p>
                        <p className="mt-2 text-lg font-medium text-slate-800">{statusText}</p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                Appointment details
                            </h2>
                            <dl className="mt-4 space-y-3 text-sm text-slate-700">
                                <div>
                                    <dt className="text-slate-500">Date & time</dt>
                                    <dd className="font-medium text-slate-800">{formatDate(appointment.date)}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Doctor</dt>
                                    <dd className="font-medium text-slate-800">{appointment.doctor.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Nurse</dt>
                                    <dd className="font-medium text-slate-800">{appointment.nurse.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Appointment ID</dt>
                                    <dd className="font-mono text-xs text-slate-800">{appointment.id}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                Contact information
                            </h2>
                            <dl className="mt-4 space-y-3 text-sm text-slate-700">
                                <div>
                                    <dt className="text-slate-500">Patient</dt>
                                    <dd className="font-medium text-slate-800">{appointment.patient.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Email</dt>
                                    <dd className="font-medium text-slate-800">{appointment.patient.email || "Not provided"}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Phone</dt>
                                    <dd className="font-medium text-slate-800">{appointment.patient.phone || "Not provided"}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    {appointment.reason && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                Reason for visit
                            </h2>
                            <p className="mt-2 text-sm text-slate-700">{appointment.reason}</p>
                        </div>
                    )}

                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                        <p className="font-medium">What happens next?</p>
                        <p className="mt-2">
                            {appointment.status === "PENDING" && "Your doctor is reviewing this request and will confirm or update the schedule soon."}
                            {appointment.status === "CONFIRMED" && "This appointment is confirmed. Please arrive 10–15 minutes early and bring any relevant records."}
                            {appointment.status === "DONE" && "This appointment has been completed. Please follow any instructions provided by your care team."}
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
