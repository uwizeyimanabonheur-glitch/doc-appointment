"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  totals: { appointments: number; patients: number; users: number; attendanceRate: number };
  statusCounts: { PENDING: number; CONFIRMED: number; DONE: number };
  perDoctor: { name: string; count: number }[];
  perNurse: { name: string; count: number }[];
}

const STATUS_COLORS = ["#f59e0b", "#3b82f6", "#10b981"];

export default function StatsCharts({ totals, statusCounts, perDoctor, perNurse }: Props) {
  const statusData = [
    { name: "Pending", value: statusCounts.PENDING },
    { name: "Confirmed", value: statusCounts.CONFIRMED },
    { name: "Done", value: statusCounts.DONE },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Appointments" value={totals.appointments} />
        <Stat label="Patients" value={totals.patients} />
        <Stat label="Staff & users" value={totals.users} />
        <Stat label="Attendance rate" value={`${totals.attendanceRate}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-600">
            Appointments per doctor
          </h2>
          <ChartOrEmpty empty={perDoctor.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perDoctor}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartOrEmpty>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-600">
            Status breakdown
          </h2>
          <ChartOrEmpty empty={totals.appointments === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartOrEmpty>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-600">
            Nurse workload (appointments created)
          </h2>
          <ChartOrEmpty empty={perNurse.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perNurse}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartOrEmpty>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="text-3xl font-semibold text-slate-800">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

function ChartOrEmpty({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
        No data yet.
      </div>
    );
  }
  return <>{children}</>;
}
