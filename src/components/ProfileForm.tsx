"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  Accessibility,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Mail,
  MonitorCog,
  MoonStar,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  SunMedium,
  UserRound,
} from "lucide-react";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { SessionUser, UserProfile } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/workflow";
import { ProfilePhotoPicker } from "./Avatar";
import { SmartInput } from "./SmartInput";

type EditableProfile = {
  displayName: string;
  department: string;
  position: string;
  phone: string;
  photoDataUrl: string;
};

type DisplayPreference = "standard" | "comfortable";

type AppearancePreferences = {
  display: DisplayPreference;
  highContrast: boolean;
  reduceMotion: boolean;
};

const DEFAULT_APPEARANCE: AppearancePreferences = {
  display: "standard",
  highContrast: false,
  reduceMotion: false,
};

function editableProfile(profile: UserProfile): EditableProfile {
  return {
    displayName: profile.displayName || "",
    department: profile.department || "",
    position: profile.position || "",
    phone: profile.phone || "",
    photoDataUrl: profile.photoDataUrl || "",
  };
}

function cleanProfile(form: EditableProfile): EditableProfile {
  return {
    displayName: form.displayName.trim(),
    department: form.department.trim(),
    position: form.position.trim(),
    phone: form.phone.trim(),
    photoDataUrl: form.photoDataUrl,
  };
}

function formatProfileDate(value: string): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function applyAppearance(preferences: AppearancePreferences) {
  const root = document.documentElement;
  root.dataset.textDensity = preferences.display;
  root.dataset.contrast = preferences.highContrast ? "high" : "standard";
  root.dataset.motion = preferences.reduceMotion ? "reduced" : "standard";
}

export function ProfileForm({
  profile,
  onSubmit,
}: {
  profile: SessionUser;
  onSubmit: (changes: Partial<UserProfile>) => Promise<void>;
}) {
  const [form, setForm] = useState<EditableProfile>(() =>
    editableProfile(profile),
  );
  const [baseline, setBaseline] = useState<EditableProfile>(() =>
    editableProfile(profile),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appearance, setAppearance] =
    useState<AppearancePreferences>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const next = editableProfile(profile);
    setForm(next);
    setBaseline(next);
  }, [
    profile.displayName,
    profile.department,
    profile.position,
    profile.phone,
    profile.photoDataUrl,
  ]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        "routetrack-appearance-preferences",
      );
      const parsed = saved
        ? (JSON.parse(saved) as Partial<AppearancePreferences>)
        : {};
      const next: AppearancePreferences = {
        display:
          parsed.display === "comfortable" ? "comfortable" : "standard",
        highContrast: Boolean(parsed.highContrast),
        reduceMotion: Boolean(parsed.reduceMotion),
      };
      setAppearance(next);
      applyAppearance(next);
    } catch {
      applyAppearance(DEFAULT_APPEARANCE);
    }
  }, []);

  const normalizedForm = useMemo(() => cleanProfile(form), [form]);
  const normalizedBaseline = useMemo(
    () => cleanProfile(baseline),
    [baseline],
  );

  const dirty =
    JSON.stringify(normalizedForm) !== JSON.stringify(normalizedBaseline);

  const completion = useMemo(() => {
    const values = [
      normalizedForm.displayName,
      profile.email,
      normalizedForm.department,
      normalizedForm.position,
      normalizedForm.phone,
      normalizedForm.photoDataUrl,
    ];

    return Math.round(
      (values.filter((value) => Boolean(String(value || "").trim())).length /
        values.length) *
        100,
    );
  }, [normalizedForm, profile.email]);

  const isAdmin =
    String(profile.role || "").trim().toLowerCase() === "admin";
  const roleLabel = isAdmin ? "Administrator" : "Student Assistant";
  const accountStatus = profile.active ? "Active account" : "Disabled account";

  function saveAppearance(next: AppearancePreferences) {
    setAppearance(next);
    applyAppearance(next);
    window.localStorage.setItem(
      "routetrack-appearance-preferences",
      JSON.stringify(next),
    );
    setFeedback({
      message: "Display preferences were saved on this device.",
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!normalizedForm.displayName) {
      setFeedback({
        message: "Enter your complete name before saving your profile.",
        error: true,
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await onSubmit(normalizedForm);
      setForm(normalizedForm);
      setBaseline(normalizedForm);
      setFeedback({
        message: "Your profile information was updated successfully.",
      });
    } catch (caught) {
      setFeedback({
        message:
          caught instanceof Error
            ? caught.message
            : "RouteTrack could not save your profile. Please try again.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  function resetChanges() {
    setForm(baseline);
    setFeedback({ message: "Unsaved profile changes were removed." });
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFeedback({
        message: "This browser could not copy the email address.",
        error: true,
      });
    }
  }

  async function requestPasswordReset() {
    if (profile.isDemo || !firebaseConfigured || !auth) {
      setFeedback({
        message: "Password recovery is unavailable while using demo mode.",
        error: true,
      });
      return;
    }

    setResettingPassword(true);
    setFeedback(null);

    try {
      auth.useDeviceLanguage();
      await sendPasswordResetEmail(auth, profile.email);
      setFeedback({
        message:
          "A secure password reset link was sent to your registered email. Check your inbox and spam folder.",
      });
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "";
      const message = raw.toLowerCase();
      setFeedback({
        message: message.includes("too-many-requests")
          ? "Too many reset attempts were made. Wait a few minutes before trying again."
          : message.includes("network")
            ? "RouteTrack could not connect. Check your internet connection and try again."
            : "The reset email could not be sent right now.",
        error: true,
      });
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="professional-profile-page">
      <section className="professional-profile-hero">
        <div className="profile-hero-glow profile-hero-glow-one" />
        <div className="profile-hero-glow profile-hero-glow-two" />

        <div className="professional-profile-identity">
          <ProfilePhotoPicker
            name={form.displayName}
            value={form.photoDataUrl}
            onChange={(photoDataUrl) =>
              setForm((current) => ({ ...current, photoDataUrl }))
            }
          />

          <div className="professional-profile-title">
            <p className="profile-hero-kicker">
              <Sparkles size={14} /> RouteTrack account profile
            </p>
            <h2>{form.displayName || "Complete your account profile"}</h2>
            <p>
              Keep your details accurate so every document route, follow-up,
              message, handover, and audit entry is clearly connected to the
              correct Purchasing Department user.
            </p>

            <div className="profile-badge-row">
              <span className={`profile-role-badge ${isAdmin ? "is-admin" : ""}`}>
                <ShieldCheck size={15} /> {roleLabel}
              </span>
              <span
                className={`profile-status-badge ${profile.active ? "is-active" : "is-disabled"}`}
              >
                <CheckCircle2 size={15} /> {accountStatus}
              </span>
            </div>
          </div>
        </div>

        <div
          className="profile-completion-card"
          aria-label={`${completion}% profile complete`}
        >
          <div
            className="profile-completion-ring"
            style={
              {
                "--profile-completion": `${completion * 3.6}deg`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{completion}%</strong>
              <span>complete</span>
            </div>
          </div>
          <div>
            <strong>Profile readiness</strong>
            <span>
              {completion === 100
                ? "Your professional account details are complete."
                : "Complete the missing details to improve accountability and communication."}
            </span>
          </div>
        </div>
      </section>

      <section className="profile-summary-grid" aria-label="Account summary">
        <article className="profile-summary-card">
          <div className="profile-summary-icon"><Briefcase size={19} /></div>
          <span>Position</span>
          <strong>{form.position || "Not yet specified"}</strong>
        </article>
        <article className="profile-summary-card">
          <div className="profile-summary-icon"><Building2 size={19} /></div>
          <span>Department</span>
          <strong>{form.department || "Not yet assigned"}</strong>
        </article>
        <article className="profile-summary-card">
          <div className="profile-summary-icon"><CalendarDays size={19} /></div>
          <span>Member since</span>
          <strong>{formatProfileDate(profile.createdAt)}</strong>
        </article>
        <article className="profile-summary-card">
          <div className="profile-summary-icon"><CheckCircle2 size={19} /></div>
          <span>Last profile update</span>
          <strong>{formatProfileDate(profile.updatedAt)}</strong>
        </article>
      </section>

      <div className="profile-content-grid">
        <form className="professional-profile-form" onSubmit={submit}>
          <section className="professional-profile-section">
            <div className="profile-section-heading">
              <div className="profile-section-icon"><UserRound size={20} /></div>
              <div>
                <p className="eyebrow">PERSONAL INFORMATION</p>
                <h3>Identity and contact details</h3>
                <span>
                  Your name appears in official routing records, messages,
                  follow-ups, shift handovers, and activity logs.
                </span>
              </div>
            </div>

            <div className="professional-profile-fields">
              <label>
                <span>Complete name <b>Required</b></span>
                <div className="profile-input-wrap">
                  <UserRound size={17} />
                  <input
                    value={form.displayName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Enter your complete name"
                    autoComplete="name"
                    required
                  />
                </div>
                <small>Use the name shown in official department records.</small>
              </label>

              <label>
                <span>Contact number <b>Optional</b></span>
                <div className="profile-input-wrap">
                  <Phone size={17} />
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="Example: 09XX XXX XXXX"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <small>Add a number where Purchasing staff can reach you.</small>
              </label>
            </div>
          </section>

          <section className="professional-profile-section">
            <div className="profile-section-heading">
              <div className="profile-section-icon"><Building2 size={20} /></div>
              <div>
                <p className="eyebrow">WORK INFORMATION</p>
                <h3>Department assignment</h3>
                <span>
                  These details explain your responsibility inside the
                  Purchasing Department and appear on account summaries.
                </span>
              </div>
            </div>

            <div className="professional-profile-fields">
              <SmartInput
                label="Department or office"
                value={form.department}
                options={DEPARTMENTS}
                onChange={(department) =>
                  setForm((current) => ({ ...current, department }))
                }
                placeholder="Choose or type a department"
              />

              <label>
                <span>Position or role title</span>
                <div className="profile-input-wrap">
                  <Briefcase size={17} />
                  <input
                    value={form.position}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        position: event.target.value,
                      }))
                    }
                    placeholder="Example: Student Assistant"
                    autoComplete="organization-title"
                  />
                </div>
                <small>Use a clear title that describes your current duty.</small>
              </label>
            </div>
          </section>

          <section className="professional-profile-section profile-security-section">
            <div className="profile-section-heading">
              <div className="profile-section-icon"><ShieldCheck size={20} /></div>
              <div>
                <p className="eyebrow">ACCOUNT AND SECURITY</p>
                <h3>Sign-in and access details</h3>
                <span>
                  Firebase Authentication protects your email and password.
                  Your access level can only be changed by an administrator.
                </span>
              </div>
            </div>

            <div className="profile-security-grid">
              <div className="profile-readonly-field">
                <div className="profile-readonly-icon"><Mail size={18} /></div>
                <div>
                  <span>Registered email</span>
                  <strong>{profile.email}</strong>
                </div>
                <button
                  type="button"
                  className="profile-copy-button"
                  onClick={copyEmail}
                  aria-label="Copy email address"
                >
                  {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="profile-readonly-field">
                <div className="profile-readonly-icon"><ShieldCheck size={18} /></div>
                <div>
                  <span>System access</span>
                  <strong>{roleLabel} · {accountStatus}</strong>
                </div>
              </div>
            </div>

            <div className="profile-password-card">
              <div className="profile-password-icon"><KeyRound size={22} /></div>
              <div>
                <strong>Password protection</strong>
                <span>
                  RouteTrack never stores a readable password. Request a secure
                  reset link when you need to create a new password.
                </span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={requestPasswordReset}
                disabled={resettingPassword || profile.isDemo}
              >
                <KeyRound size={16} />
                {resettingPassword ? "Sending…" : "Send reset link"}
              </button>
            </div>
          </section>

          {feedback && (
            <div
              className={`profile-feedback ${feedback.error ? "is-error" : "is-success"}`}
              role={feedback.error ? "alert" : "status"}
            >
              {feedback.error ? <ShieldCheck size={17} /> : <CheckCircle2 size={17} />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="professional-profile-actions">
            <div>
              <strong>{dirty ? "Unsaved profile changes" : "Profile is up to date"}</strong>
              <span>
                {dirty
                  ? "Review your information before saving the update."
                  : "Future profile changes will be recorded in the activity log."}
              </span>
            </div>

            <div className="profile-action-buttons">
              <button
                type="button"
                className="secondary-button"
                onClick={resetChanges}
                disabled={!dirty || saving}
              >
                <RotateCcw size={16} /> Reset
              </button>
              <button
                type="submit"
                className="primary-button profile-save-button"
                disabled={!dirty || saving}
              >
                <Save size={16} /> {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>
        </form>

        <aside className="profile-preferences-column">
          <section className="profile-preference-card">
            <div className="profile-preference-heading">
              <div className="profile-section-icon"><MonitorCog size={20} /></div>
              <div>
                <p className="eyebrow">DISPLAY PREFERENCES</p>
                <h3>Readability on this device</h3>
                <span>
                  These preferences improve text visibility without changing
                  your account or other users’ screens.
                </span>
              </div>
            </div>

            <div className="profile-preference-list">
              <div className="profile-preference-row">
                <div>
                  <Eye size={18} />
                  <span>
                    <strong>Text spacing</strong>
                    <small>Choose a denser or more comfortable layout.</small>
                  </span>
                </div>
                <div className="profile-segmented-control" role="group" aria-label="Text spacing">
                  <button
                    type="button"
                    className={appearance.display === "standard" ? "active" : ""}
                    onClick={() => saveAppearance({ ...appearance, display: "standard" })}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className={appearance.display === "comfortable" ? "active" : ""}
                    onClick={() => saveAppearance({ ...appearance, display: "comfortable" })}
                  >
                    Comfortable
                  </button>
                </div>
              </div>

              <label className="profile-switch-row">
                <span>
                  <Accessibility size={18} />
                  <span>
                    <strong>Higher contrast</strong>
                    <small>Strengthens secondary text and borders.</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={appearance.highContrast}
                  onChange={(event) =>
                    saveAppearance({
                      ...appearance,
                      highContrast: event.target.checked,
                    })
                  }
                />
              </label>

              <label className="profile-switch-row">
                <span>
                  <Sparkles size={18} />
                  <span>
                    <strong>Reduce motion</strong>
                    <small>Limits decorative movement and animations.</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={appearance.reduceMotion}
                  onChange={(event) =>
                    saveAppearance({
                      ...appearance,
                      reduceMotion: event.target.checked,
                    })
                  }
                />
              </label>
            </div>

            <div className="profile-theme-note">
              <span className="profile-theme-icons">
                <SunMedium size={17} />
                <MoonStar size={17} />
              </span>
              <p>
                Use the sun or moon button in the top bar to switch between
                light and dark mode. RouteTrack now uses stronger text contrast
                in both appearances.
              </p>
            </div>
          </section>

          <section className="profile-information-card">
            <div className="profile-information-icon"><ShieldCheck size={20} /></div>
            <div>
              <strong>How your information is used</strong>
              <p>
                Your profile identifies who recorded, routed, acknowledged,
                followed up, or updated a document. Keep it accurate for a clear
                audit trail.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
