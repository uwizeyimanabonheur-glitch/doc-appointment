"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus, Role } from "@prisma/client";
import StatusBadge from "@/components/StatusBadge";
import IconButton from "@/components/IconButton";
import Drawer, { DetailField } from "@/components/Drawer";
import Pagination, { paginate, pageCount, PAGE_SIZE } from "@/components/Pagination";
import { CheckIcon, CheckCircleIcon, TrashIcon, SearchIcon, RotateCcwIcon } from "@/components/icons";

interface Row {
  id: string;
  date: string;
  status: AppointmentStatus;
  reason: string | null;
  patient: { id: string; name: string; code: string };
  doctor: { id: string; name: string };
  nurse: { id: string; name: string };
}

interface Props {
  role: Role;
  currentUserId: string;
  initialRows: Row[];
  doctors: { id: string; name: string }[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Short preview of a long text field for table cells.
function preview(text: string | null, n = 10): string {
  if (!text) return "—";
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

// Format a Date as a YYYY-MM-DD string for <input type="date">.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday–Sunday range for the week containing `now`.
function currentWeek(): { from: string; to: string } {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toISODate(monday), to: toISODate(sunday) };
}

const STATUS_ORDER: AppointmentStatus[] = ["PENDING", "CONFIRMED", "DONE"];

// Distinct {id,name} people from the rows, for building filter dropdowns.
function distinctPeople(rows: Row[], key: "doctor" | "nurse") {
  const map = new Map<string, string>();
  for (const r of rows) map.set(r[key].id, r[key].name);
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export default function AppointmentsClient({
  role,
  currentUserId,
  initialRows,
  doctors,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  // Toolbar state.
  const [query, setQuery] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [nurseFilter, setNurseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | AppointmentStatus>("");
  // Date range — defaults to the current week.
  const [range, setRange] = useState(() => currentWeek());
  const [page, setPage] = useState(1);

  const canBook = role === "NURSE" || role === "ADMIN";
  const showDoctorFilter = role === "ADMIN" || role === "NURSE";
  const showNurseFilter = role === "ADMIN" || role === "DOCTOR";

  const doctorOptions = useMemo(() => distinctPeople(rows, "doctor"), [rows]);
  const nurseOptions = useMemo(() => distinctPeople(rows, "nurse"), [rows]);

  // Search placeholder + matcher depend on role. Doctors/Nurses search by
  // patient code (to avoid namesakes); Admin can search across everything.
  const searchPlaceholder =
    role === "ADMIN"
      ? "Search by patient, code, doctor or nurse…"
      : role === "PATIENT"
      ? "Search by doctor or reason…"
      : "Search patient by code or name…";

  function matches(row: Row, q: string): boolean {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const fields: string[] = [];
    if (role === "ADMIN") {
      fields.push(row.patient.name, row.patient.code, row.doctor.name, row.nurse.name);
    } else if (role === "PATIENT") {
      fields.push(row.doctor.name, row.reason ?? "", row.patient.code);
    } else {
      // NURSE / DOCTOR — primarily by patient code.
      fields.push(row.patient.code, row.patient.name);
    }
    return fields.some((f) => f.toLowerCase().includes(needle));
  }

  const filtered = useMemo(() => {
    const fromTs = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
    const toTs = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;
    return rows.filter((r) => {
      const t = new Date(r.date).getTime();
      return (
        matches(r, query) &&
        (!doctorFilter || r.doctor.id === doctorFilter) &&
        (!nurseFilter || r.nurse.id === nurseFilter) &&
        (!statusFilter || r.status === statusFilter) &&
        (fromTs === null || t >= fromTs) &&
        (toTs === null || t <= toTs)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, doctorFilter, nurseFilter, statusFilter, range.from, range.to, role]);

  // Summary of the currently-filtered set (respects the date range + filters).
  const summary = useMemo(() => {
    const s = { total: filtered.length, PENDING: 0, CONFIRMED: 0, DONE: 0, upcoming: 0 };
    const now = Date.now();
    for (const r of filtered) {
      s[r.status] += 1;
      if (r.status !== "DONE" && new Date(r.date).getTime() >= now) s.upcoming += 1;
    }
    return s;
  }, [filtered]);

  // Keep the current page within range when filters change.
  useEffect(() => {
    const pc = pageCount(filtered.length);
    if (page > pc) setPage(pc);
  }, [filtered.length, page]);

  const pageRows = paginate(filtered, page);
  const hasFilters = query || doctorFilter || nurseFilter || statusFilter;

  async function refresh() {
    const res = await fetch("/api/appointments");
    const data = await res.json();
    if (res.ok) {
      setRows(data.appointments);
      // Keep the open drawer in sync with the latest row data.
      setSelected((prev) =>
        prev ? data.appointments.find((r: Row) => r.id === prev.id) ?? null : null,
      );
    }
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Update failed");
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this appointment?")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
        return;
      }
      setRows((r) => r.filter((x) => x.id !== id));
      setSelected((sel) => (sel?.id === id ? null : sel));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // Icon actions available on a row for this role.
  function actionsFor(row: Row) {
    const nodes: React.ReactNode[] = [];
    const isDoctorOfRow = row.doctor.id === currentUserId;
    const isNurseOfRow = row.nurse.id === currentUserId;
    const disabled = busy === row.id;

    if (role === "DOCTOR" && isDoctorOfRow) {
      if (row.status === "PENDING") {
        nodes.push(
          <IconButton key="accept" label="Accept" variant="primary" disabled={disabled}
            onClick={() => patch(row.id, { status: "CONFIRMED" })}>
            <CheckIcon />
          </IconButton>,
        );
      }
      if (row.status === "CONFIRMED") {
        nodes.push(
          <IconButton key="done" label="Mark done" variant="success" disabled={disabled}
            onClick={() => patch(row.id, { status: "DONE" })}>
            <CheckCircleIcon />
          </IconButton>,
        );
      }
    }

    if (role === "ADMIN") {
      if (row.status === "PENDING") {
        nodes.push(
          <IconButton key="aconf" label="Confirm" variant="primary" disabled={disabled}
            onClick={() => patch(row.id, { status: "CONFIRMED" })}>
            <CheckIcon />
          </IconButton>,
        );
      }
      if (row.status === "CONFIRMED") {
        nodes.push(
          <IconButton key="adone" label="Mark done" variant="success" disabled={disabled}
            onClick={() => patch(row.id, { status: "DONE" })}>
            <CheckCircleIcon />
          </IconButton>,
        );
      }
    }

    // Reopen a mistakenly-completed appointment (Doctor of the row / Admin).
    const canManageStatus = role === "ADMIN" || (role === "DOCTOR" && isDoctorOfRow);
    if (canManageStatus && row.status === "DONE") {
      nodes.push(
        <IconButton key="reopen" label="Reopen (set to Confirmed)" disabled={disabled}
          onClick={() => patch(row.id, { status: "CONFIRMED" })}>
          <RotateCcwIcon />
        </IconButton>,
      );
    }

    // Nurse may delete only her own, still-pending appointments; admin always.
    if ((role === "NURSE" && isNurseOfRow && row.status === "PENDING") || role === "ADMIN") {
      nodes.push(
        <IconButton key="del" label="Delete" variant="danger" disabled={disabled}
          onClick={() => remove(row.id)}>
          <TrashIcon />
        </IconButton>,
      );
    }

    return nodes.length ? (
      <div className="flex items-center gap-2">{nodes}</div>
    ) : null;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Appointments</h1>
          <p className="text-sm text-slate-500">
            {role === "PATIENT" && "Your appointments"}
            {role === "NURSE" && "Appointments you created"}
            {role === "DOCTOR" && "Appointments assigned to you"}
            {role === "ADMIN" && "All appointments"}
          </p>
        </div>
        {canBook && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "Book appointment"}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {canBook && showForm && (
        <BookingForm
          doctors={doctors}
          onDone={async () => {
            setShowForm(false);
            await refresh();
          }}
          onError={setError}
        />
      )}

      {/* Summary — reflects the selected date range + filters */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Total bookings" value={summary.total} />
        <SummaryCard label="Pending" value={summary.PENDING} tone="amber" />
        <SummaryCard label="Confirmed" value={summary.CONFIRMED} tone="blue" />
        <SummaryCard label="Done" value={summary.DONE} tone="emerald" />
        <SummaryCard label="Upcoming" value={summary.upcoming} />
      </div>

      {/* Date range */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input w-auto"
            value={range.from}
            onChange={(e) => {
              setRange((r) => ({ ...r, from: e.target.value }));
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input w-auto"
            value={range.to}
            onChange={(e) => {
              setRange((r) => ({ ...r, to: e.target.value }));
              setPage(1);
            }}
          />
        </div>
        <button
          className="btn-ghost"
          onClick={() => {
            setRange(currentWeek());
            setPage(1);
          }}
        >
          This week
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            setRange({ from: "", to: "" });
            setPage(1);
          }}
        >
          All dates
        </button>
      </div>

      {/* Toolbar: search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            className="input pl-9"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {showDoctorFilter && doctorOptions.length > 1 && (
          <select
            className="input w-auto"
            value={doctorFilter}
            onChange={(e) => {
              setDoctorFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All doctors</option>
            {doctorOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        {showNurseFilter && nurseOptions.length > 1 && (
          <select
            className="input w-auto"
            value={nurseFilter}
            onChange={(e) => {
              setNurseFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All nurses</option>
            {nurseOptions.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        )}

        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "" | AppointmentStatus);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            className="btn-ghost"
            onClick={() => {
              setQuery("");
              setDoctorFilter("");
              setNurseFilter("");
              setStatusFilter("");
              setPage(1);
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Doctor</th>
                {(role === "ADMIN" || role === "DOCTOR") && <th className="px-4 py-3">Booked by</th>}
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {rows.length === 0 ? "No appointments yet." : "No appointments match your filters."}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className={`cursor-pointer hover:bg-slate-50 ${
                    selected?.id === row.id ? "bg-brand/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(row.date)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">{row.patient.name}</div>
                    <div className="text-xs text-slate-400">{row.patient.code}</div>
                  </td>
                  <td className="px-4 py-3">{row.doctor.name}</td>
                  {(role === "ADMIN" || role === "DOCTOR") && (
                    <td className="px-4 py-3 text-slate-500">{row.nurse.name}</td>
                  )}
                  <td className="px-4 py-3 text-slate-500" title={row.reason || undefined}>
                    {preview(row.reason)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {actionsFor(row) ?? <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} size={PAGE_SIZE} onChange={setPage} />
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Appointment details"
        footer={
          selected && actionsFor(selected) ? (
            <div className="flex items-center gap-2">{actionsFor(selected)}</div>
          ) : undefined
        }
      >
        {selected && (
          <dl>
            <DetailField label="Status">
              <StatusBadge status={selected.status} />
              {(role === "ADMIN" ||
                (role === "DOCTOR" && selected.doctor.id === currentUserId)) && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-slate-400">Change status</div>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                    {STATUS_ORDER.map((s) => {
                      const active = selected.status === s;
                      return (
                        <button
                          key={s}
                          disabled={active || busy === selected.id}
                          onClick={() => patch(selected.id, { status: s })}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default ${
                            active
                              ? "bg-brand text-white"
                              : "bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </DetailField>
            <DetailField label="Date & time">{fmt(selected.date)}</DetailField>
            <DetailField label="Patient">
              <div className="font-medium">{selected.patient.name}</div>
              <div className="text-xs text-slate-400">Code: {selected.patient.code}</div>
            </DetailField>
            <DetailField label="Doctor">{selected.doctor.name}</DetailField>
            <DetailField label="Booked by (nurse)">{selected.nurse.name}</DetailField>
            <DetailField label="Reason">
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {selected.reason || "No reason provided."}
              </p>
            </DetailField>
          </dl>
        )}
      </Drawer>
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  slate: "text-slate-800",
  amber: "text-amber-600",
  blue: "text-blue-600",
  emerald: "text-emerald-600",
};

function SummaryCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONE_STYLES;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className={`text-lg font-semibold ${TONE_STYLES[tone]}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

interface PatientHit {
  id: string;
  name: string;
  code: string;
}

function BookingForm({
  doctors,
  onDone,
  onError,
}: {
  doctors: { id: string; name: string }[];
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Patient search-by-code flow.
  const [code, setCode] = useState("");
  const [results, setResults] = useState<PatientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [patient, setPatient] = useState<PatientHit | null>(null);

  async function searchPatients() {
    const q = code.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/patients?code=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(res.ok ? data.patients : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    if (!patient) {
      onError("Search and select a patient by code first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, doctorId, date, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        onError(data.error || "Could not book appointment");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 grid gap-4 md:grid-cols-2">
      {/* Patient — search by code */}
      <div className="md:col-span-2">
        <label className="label">Patient</label>

        {patient ? (
          <div className="flex items-center justify-between rounded-md border border-brand/30 bg-brand/5 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-slate-700">{patient.name}</div>
              <div className="text-xs text-slate-500">{patient.code}</div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPatient(null);
                setResults([]);
                setSearched(false);
                setCode("");
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  className="input pl-9"
                  placeholder="Enter patient code, e.g. PT-4F9A2B"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPatients();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={searchPatients}
                disabled={searching || !code.trim()}
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>

            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPatient(p);
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-700">{p.name}</span>
                      <span className="badge bg-brand/10 text-brand">{p.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {searched && !searching && results.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No patient found for “{code.trim()}”.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="label">Doctor</label>
        <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
          <option value="">Select doctor…</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Date & time</label>
        <input type="datetime-local" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="md:col-span-2">
        <label className="label">Reason (optional)</label>
        <input type="text" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diabetes follow-up" />
      </div>
      <div className="md:col-span-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Booking…" : "Book appointment"}
        </button>
      </div>
    </form>
  );
}
