"use client";

import { useRef, useState } from "react";

interface Doc {
  id: string;
  filename: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
}

export default function KycPanel({ kycStatus, docs }: { kycStatus: string; docs: Doc[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState(docs);

  const badgeClass = kycStatus === "VERIFIED" ? "ok" : kycStatus === "REJECTED" ? "bad" : kycStatus === "PENDING" ? "warn" : "";

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/kyc/upload", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
      return;
    }
    setLocalDocs((prev) => [{ id: data.id, filename: data.filename, status: "PENDING" }, ...prev]);
    setMessage("Uploaded — pending review.");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 14 }}>Required before your first payout.</p>
        {badgeClass && <span className={`badge ${badgeClass}`}>{kycStatus}</span>}
      </div>

      <form onSubmit={upload} style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ maxWidth: 260 }} />
        <button className="btn btn-ghost" type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload document"}
        </button>
      </form>
      {message && <p className="hint" style={{ marginTop: 8 }}>{message}</p>}

      {localDocs.length > 0 && (
        <table style={{ marginTop: 18 }}>
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {localDocs.map((d) => (
              <tr key={d.id}>
                <td className="mono" style={{ fontSize: 12.5 }}>{d.filename}</td>
                <td>
                  <span className={`badge ${d.status === "VERIFIED" ? "ok" : d.status === "REJECTED" ? "bad" : "warn"}`}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
