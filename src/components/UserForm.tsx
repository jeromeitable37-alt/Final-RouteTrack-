"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ManagedUserInput, UserProfile } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/workflow";
import { ProfilePhotoPicker } from "./Avatar";
import { SmartInput } from "./SmartInput";

export function UserForm({ profile, isSelf, onSubmit, onCancel }: {
  profile?: UserProfile | null;
  isSelf?: boolean;
  onSubmit: (input: ManagedUserInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ManagedUserInput>({
    displayName: profile?.displayName || "",
    email: profile?.email || "",
    department: profile?.department || "",
    position: profile?.position || "",
    phone: profile?.phone || "",
    photoDataUrl: profile?.photoDataUrl || "",
    role: profile?.role || "staff",
    active: profile?.active ?? true,
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  }

  return (
    <form className="document-form" onSubmit={submit}>
      <ProfilePhotoPicker name={form.displayName} value={form.photoDataUrl} onChange={(photoDataUrl) => setForm({ ...form, photoDataUrl })} />
      <div className="form-grid">
        <label>Full name<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label>
        <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={Boolean(profile)} required /></label>
        <SmartInput label="Department / office" value={form.department} options={DEPARTMENTS} onChange={(department) => setForm({ ...form, department })} placeholder="Choose or type department" />
        <label>Position<input value={form.position || ""} onChange={(event) => setForm({ ...form, position: event.target.value })} /></label>
        <label>Contact number<input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ManagedUserInput["role"] })} disabled={isSelf}><option value="staff">Staff</option><option value="admin">Administrator</option></select></label>
        {!profile && <label className="span-2">Temporary password<div className="password-field"><input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={6} required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><span className="field-help">Give this password privately to the new user. It is handled by Firebase Authentication.</span></label>}
        <label className="toggle-label span-2"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} disabled={isSelf} /><span><strong>Account is active</strong><small>Disabled users cannot access the routing system.</small></span></label>
      </div>
      {isSelf && <p className="info-note">You cannot disable your own account or remove your own administrator access.</p>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : profile ? "Save account" : "Create account"}</button></div>
    </form>
  );
}
