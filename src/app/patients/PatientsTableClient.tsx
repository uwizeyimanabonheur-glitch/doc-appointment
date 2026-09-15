"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Pagination, { PAGE_SIZE, paginate, pageCount } from "@/components/Pagination";
import IconButton from "@/components/IconButton";
import { TrashIcon, SearchIcon, PencilIcon, CheckIcon, XIcon } from "@/components/icons";

type Row = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    code: string;
    createdByName?: string | null;
    createdAt?: string | null;
};

type SortKey = keyof Omit<Row, "id"> | null;

export default function PatientsTableClient({ initialRows, currentUserId }: { initialRows: Row[]; currentUserId: string; }) {
    const router = useRouter();
    const [rows, setRows] = useState<Row[]>(initialRows);
    const [query, setQuery] = useState("");
    const [createdByFilter, setCreatedByFilter] = useState<string>("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [editId, setEditId] = useState<string | null>(null);
    const [edit, setEdit] = useState({ name: "", email: "", phone: "" });

    useEffect(() => {
        setRows(initialRows);
    }, [initialRows]);

    const creators = useMemo(() => {
        const set = new Set<string>();
        initialRows.forEach((r) => { if (r.createdByName) set.add(r.createdByName); });
        return Array.from(set).sort();
    }, [initialRows]);

    function toggleSort(key: SortKey) {
        if (sortBy === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(key);
            setSortDir("asc");
        }
    }

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        let out = rows.filter((r) =>
            (!createdByFilter || (r.createdByName || "") === createdByFilter) &&
            (!needle ||
                r.name.toLowerCase().includes(needle) ||
                (r.email || "").toLowerCase().includes(needle) ||
                (r.phone || "").toLowerCase().includes(needle) ||
                r.code.toLowerCase().includes(needle))
        );

        if (sortBy) {
            out = out.slice().sort((a, b) => {
                const av = (a as any)[sortBy];
                const bv = (b as any)[sortBy];
                if (av == null && bv == null) return 0;
                if (av == null) return sortDir === "asc" ? -1 : 1;
                if (bv == null) return sortDir === "asc" ? 1 : -1;
                if (typeof av === "string" && typeof bv === "string") {
                    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
                }
                // fallback for dates represented as ISO strings
                if (av > bv) return sortDir === "asc" ? 1 : -1;
                if (av < bv) return sortDir === "asc" ? -1 : 1;
                return 0;
            });
        }
        return out;
    }, [rows, query, createdByFilter, sortBy, sortDir]);

    useEffect(() => {
        const pc = pageCount(filtered.length);
        if (page > pc) setPage(pc);
    }, [filtered.length, page]);

    const pageRows = paginate(filtered, page, pageSize);
    const selectedCount = Object.keys(selected).filter((k) => selected[k]).length;

    function startEdit(row: Row) {
        setEditId(row.id);
        setEdit({
            name: row.name,
            email: row.email || "",
            phone: row.phone || "",
        });
        setError(null);
    }

    async function saveEdit(id: string) {
        if (!edit.name.trim()) {
            setError("Name is required");
            return;
        }

        setBusy(id);
        setError(null);
        try {
            const res = await fetch(`/api/patients/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(edit),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Could not update patient");
                return;
            }

            setRows((r) => r.map((row) => row.id === id ? {
                ...row,
                name: data.patient.name,
                email: data.patient.email,
                phone: data.patient.phone,
            } : row));
            setEditId(null);
            router.refresh();
        } catch (err) {
            setError(String(err));
        } finally {
            setBusy(null);
        }
    }

    async function remove(id: string) {
        if (!confirm("Delete this patient? This cannot be undone.")) return;
        setBusy(id);
        setError(null);
        try {
            const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Could not delete patient");
                return;
            }
            setRows((r) => r.filter((x) => x.id !== id));
            router.refresh();
        } catch (err) {
            setError(String(err));
        } finally {
            setBusy(null);
        }
    }

    function toggleSelect(id: string) {
        setSelected((s) => ({ ...s, [id]: !s[id] }));
    }

    function selectAllOnPage(checked: boolean) {
        const next: Record<string, boolean> = { ...selected };
        pageRows.forEach((r) => { next[r.id] = checked; });
        setSelected(next);
    }

    async function bulkDelete() {
        const ids = Object.keys(selected).filter((k) => selected[k]);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} patients? This cannot be undone.`)) return;
        setBusy("bulk");
        setError(null);
        try {
            await Promise.all(ids.map((id) => fetch(`/api/patients/${id}`, { method: "DELETE" })));
            setRows((r) => r.filter((x) => !ids.includes(x.id)));
            setSelected({});
            router.refresh();
        } catch (err) {
            setError(String(err));
        } finally {
            setBusy(null);
        }
    }

    function exportCsv() {
        const ids = Object.keys(selected).filter((k) => selected[k]);
        const toExport = ids.length > 0 ? rows.filter((r) => ids.includes(r.id)) : filtered;
        const headers = ["id", "name", "code", "email", "phone", "createdBy", "createdAt"];
        const csv = [headers.join(",")]
            .concat(toExport.map((r) => [r.id, r.name, r.code, r.email || "", r.phone || "", r.createdByName || "", r.createdAt || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `patients_export_${new Date().toISOString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-6">
            {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                    <input className="input pl-9" placeholder="Search by name, email, phone or code…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
                </div>
                <select className="input w-auto" value={createdByFilter} onChange={(e) => { setCreatedByFilter(e.target.value); setPage(1); }}>
                    <option value="">All creators</option>
                    {creators.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <select className="input w-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    <option value={8}>8 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                </select>
                <button className="btn-ghost" onClick={exportCsv}>Export CSV</button>
                {(query || createdByFilter) && (
                    <button className="btn-ghost" onClick={() => { setQuery(""); setCreatedByFilter(""); setPage(1); }}>
                        Clear
                    </button>
                )}
            </div>

            {selectedCount > 0 && (
                <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-600">{selectedCount} selected</div>
                    <button className="btn" onClick={bulkDelete} disabled={busy === "bulk"}>Delete selected</button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">
                                    <input type="checkbox" aria-label="Select all on page" onChange={(e) => selectAllOnPage(e.target.checked)} />
                                </th>
                                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("name")}>Name {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}</th>
                                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("code")}>Code {sortBy === "code" && (sortDir === "asc" ? "▲" : "▼")}</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Created by</th>
                                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("createdAt")}>
                                    Created {sortBy === "createdAt" && (sortDir === "asc" ? "▲" : "▼")}
                                </th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 && (
                                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No patients found.</td></tr>
                            )}
                            {pageRows.map((row) => {
                                const editing = editId === row.id;
                                return (
                                    <tr key={row.id} className="align-top hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <input type="checkbox" checked={!!selected[row.id]} onChange={() => toggleSelect(row.id)} aria-label={`Select ${row.name}`} />
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {editing ? (
                                                <input
                                                    className="input w-full min-w-[140px]"
                                                    value={edit.name}
                                                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                                                    aria-label={`Edit patient name for ${row.name}`}
                                                />
                                            ) : row.name}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{row.code}</td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {editing ? (
                                                <input
                                                    type="email"
                                                    className="input w-full min-w-[170px]"
                                                    value={edit.email}
                                                    onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                                                    aria-label={`Edit patient email for ${row.name}`}
                                                />
                                            ) : (row.email || "—")}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {editing ? (
                                                <input
                                                    className="input w-full min-w-[130px]"
                                                    value={edit.phone}
                                                    onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                                                    aria-label={`Edit patient phone for ${row.name}`}
                                                />
                                            ) : (row.phone || "—")}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{row.createdByName || "—"}</td>
                                        <td className="px-4 py-3 text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {editing ? (
                                                    <>
                                                        <IconButton label="Save patient" variant="success" disabled={busy === row.id} onClick={() => saveEdit(row.id)}>
                                                            <CheckIcon />
                                                        </IconButton>
                                                        <IconButton label="Cancel edit" variant="default" onClick={() => setEditId(null)}>
                                                            <XIcon />
                                                        </IconButton>
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconButton label="Edit patient" variant="default" onClick={() => startEdit(row)}>
                                                            <PencilIcon />
                                                        </IconButton>
                                                        <IconButton label="Delete" variant="danger" disabled={busy === row.id} onClick={() => remove(row.id)}>
                                                            <TrashIcon />
                                                        </IconButton>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} total={filtered.length} size={pageSize} onChange={setPage} />
            </div>
        </div>
    );
}
