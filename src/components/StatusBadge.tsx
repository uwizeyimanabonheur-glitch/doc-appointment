import type { AppointmentStatus } from "@prisma/client";

const STYLES: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DONE: "bg-emerald-100 text-emerald-700",
};

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{status}</span>;
}
