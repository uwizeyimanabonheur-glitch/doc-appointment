"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import IconButton from "@/components/IconButton";
import { TrashIcon } from "@/components/icons";

interface Row {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    code: string;
    createdByName?: string | null;
}

export default function PatientsClient({ initialRows, currentUserId }: { initialRows: Row[]; currentUserId: string; }) {
    const router = useRouter();
    const [rows, setRows] = useState<Row[]>(initialRows);

    useEffect(() => {
        setRows(initialRows);
    }, [initialRows]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function remove(id: string) {
        if (!confirm("Delete this patient? This will remove all related appointments.")) return;
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

    return (
        <div>
            {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recently registered</h2>
            <ul className="space-y-2">
                {rows.length === 0 && (
                    <li className="text-sm text-slate-400">No patients yet.</li>
                )}
                {rows.map((p) => (
                    <li key={p.id} className="card flex items-center justify-between py-3">
                        <div>
                            <div className="font-medium text-slate-700">{p.name}</div>
                            <div className="text-xs text-slate-400">{p.email || "no email"} · {p.phone || "no phone"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="badge bg-brand/10 text-brand">{p.code}</span>
                            <IconButton label="Delete" variant="danger" disabled={busy === p.id} onClick={() => remove(p.id)}>
                                <TrashIcon />
                            </IconButton>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
