"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import IconButton from "@/components/IconButton";
import Pagination, { paginate, pageCount, PAGE_SIZE } from "@/components/Pagination";
import { CheckIcon, TrashIcon, PencilIcon, XIcon, SearchIcon } from "@/components/icons";

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  DOCTOR: "bg-blue-100 text-blue-700",
  NURSE: "bg-teal-100 text-teal-700",
  PATIENT: "bg-slate-100 text-slate-600",
};

const EMPTY = { name: "", email: "", phone: "", role: "DOCTOR" as Role, password: "" };

export default function UsersClient({
  initialRows,
  currentUserId,
}: {
  initialRows: Row[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Create form state.
  const [form, setForm] = useState({ ...EMPTY });
  const [creating, setCreating] = useState(false);

  // Inline edit state.
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", email: "", phone: "", role: "DOCTOR" as Role, password: "" });

  // Search + pagination.
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!roleFilter || r.role === roleFilter) &&
        (!needle ||
          r.name.toLowerCase().includes(needle) ||
          r.email.toLowerCase().includes(needle) ||
          (r.phone ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, query, roleFilter]);

  useEffect(() => {
    const pc = pageCount(filtered.length);
    if (page > pc) setPage(pc);
  }, [filtered.length, page]);

  const pageRows = paginate(filtered, page);

  async function refresh() {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setRows(
        data.users.map((u: Row) => ({ ...u, createdAt: u.createdAt })),
      );
    }
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create user");
        return;
      }
      setForm({ ...EMPTY });
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(row: Row) {
    setEditId(row.id);
    setEdit({
      name: row.name,
      email: row.email,
      phone: row.phone ?? "",
      role: row.role,
      password: "",
    });
    setError(null);
  }

  async function saveEdit(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update user");
        return;
      }
      setEditId(null);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete user");
        return;
      }
      setRows((r) => r.filter((x) => x.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Create user */}
      <form onSubmit={create} className="card grid gap-4 md:grid-cols-5">
        <div className="md:col-span-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Add a user
          </h2>
        </div>
        <div className="md:col-span-1">
          <label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Jane Doe" />
        </div>
        <div className="md:col-span-1">
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="jane@example.com" />
        </div>
        <div className="md:col-span-1">
          <label className="label">Phone</label>
          <input className="input" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+15551234567" />
        </div>
        <div className="md:col-span-1">
          <label className="label">Role</label>
          <select className="input" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="label">Password</label>
          <input className="input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="default: password123" />
        </div>
        <div className="md:col-span-5">
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>

      {/* Toolbar: search + role filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            className="input pl-9"
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {(query || roleFilter) && (
          <button className="btn-ghost" onClick={() => { setQuery(""); setRoleFilter(""); setPage(1); }}>
            Clear
          </button>
        )}
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0 ? "No users." : "No users match your search."}
              </td></tr>
            )}
            {pageRows.map((row) => {
              const isEditing = editId === row.id;
              const isSelf = row.id === currentUserId;
              return (
                <tr key={row.id} className="align-top hover:bg-slate-50">
                  {isEditing ? (
                    <>
                      <td className="px-4 py-3">
                        <input className="input" value={edit.name}
                          onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <input className="input" value={edit.email}
                          onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <input className="input" value={edit.phone}
                          onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <select className="input" value={edit.role}
                          onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <input className="input mt-2" value={edit.password}
                          onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                          placeholder="new password (optional)" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <IconButton label="Save" variant="primary" disabled={busy === row.id}
                            onClick={() => saveEdit(row.id)}>
                            <CheckIcon />
                          </IconButton>
                          <IconButton label="Cancel" onClick={() => setEditId(null)}>
                            <XIcon />
                          </IconButton>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {row.name}
                        {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.email}</td>
                      <td className="px-4 py-3 text-slate-500">{row.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${ROLE_BADGE[row.role]}`}>{ROLE_LABELS[row.role]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <IconButton label="Edit" onClick={() => startEdit(row)}>
                            <PencilIcon />
                          </IconButton>
                          <IconButton label={isSelf ? "You cannot delete yourself" : "Delete"}
                            variant="danger" disabled={busy === row.id || isSelf}
                            onClick={() => remove(row.id)}>
                            <TrashIcon />
                          </IconButton>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <Pagination page={page} total={filtered.length} size={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  );
}
