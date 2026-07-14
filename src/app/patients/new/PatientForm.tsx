"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedCode(null);
    setSaving(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create patient");
        return;
      }
      setCreatedCode(data.patient.code);
      setName("");
      setEmail("");
      setPhone("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {createdCode && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Patient created. Code: <strong>{createdCode}</strong>
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      <div>
        <label className="label">Full name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
      </div>
      <div>
        <label className="label">Email (for notifications)</label>
        <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
      </div>
      <div>
        <label className="label">Phone (for SMS)</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15551234567" />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? "Saving…" : "Register patient"}
      </button>
    </form>
  );
}
