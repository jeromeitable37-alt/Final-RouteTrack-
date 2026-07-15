"use client";

import { FormEvent, useState } from "react";
import { UserProfile } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/workflow";
import { ProfilePhotoPicker } from "./Avatar";
import { SmartInput } from "./SmartInput";

export function ProfileForm({ profile, onSubmit }: { profile: UserProfile; onSubmit: (changes: Partial<UserProfile>) => Promise<void> }) {
  const [form, setForm] = useState({
    displayName: profile.displayName,
    department: profile.department || "",
    position: profile.position || "",
    phone: profile.phone || "",
    photoDataUrl: profile.photoDataUrl || "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <ProfilePhotoPicker name={form.displayName} value={form.photoDataUrl} onChange={(photoDataUrl) => setForm({ ...form, photoDataUrl })} />
      <div className="form-grid">
        <label>Full name<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label>
        <label>Email address<input value={profile.email} disabled /></label>
        <SmartInput label="Department / office" value={form.department} options={DEPARTMENTS} onChange={(department) => setForm({ ...form, department })} placeholder="Choose or type a department" />
        <label>Position / role title<input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Example: Student Assistant" /></label>
        <label className="span-2">Contact number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional" /></label>
      </div>
      <div className="profile-account-note"><strong>System access:</strong> {String(profile.role).trim().toLowerCase() === "admin" ? "Administrator" : "Staff"}. Passwords are handled by Firebase Authentication and are never saved in the document database.</div>
      <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
    </form>
  );
}
