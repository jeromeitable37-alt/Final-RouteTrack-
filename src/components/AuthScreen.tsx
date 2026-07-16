"use client";

import { FormEvent, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { SessionUser, UserProfile } from "@/lib/types";
import { isBootstrapAdminEmail } from "@/lib/admin-config";

type AuthMode = "login" | "register" | "forgot-password";

function cleanFirebaseError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unable to continue.";

  return message
    .replace("Firebase: ", "")
    .replace(/\(auth\/.+\)\.?/, "")
    .trim();
}

export function AuthScreen({
  onDemo,
}: {
  onDemo: (user: SessionUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("Student Assistant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!auth) {
      setError("Firebase Authentication is not configured.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "forgot-password") {
        auth.useDeviceLanguage();

        await sendPasswordResetEmail(auth, normalizedEmail);

        // Keep this message generic for privacy. It does not reveal whether
        // an email address is registered in the system.
        setSuccess(
          "When the email is registered, Firebase will send a password reset link. Check your inbox and spam folder."
        );

        return;
      }

      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

        if (name.trim()) {
          await updateProfile(credential.user, {
            displayName: name.trim(),
          });
        }

        if (db) {
          const now = new Date().toISOString();

          const profile: UserProfile = {
            uid: credential.user.uid,
            email: normalizedEmail,
            displayName:
              name.trim() ||
              normalizedEmail.split("@")[0] ||
              "RouteTrack User",
            department: department.trim(),
            position: position.trim(),
            phone: "",
            photoDataUrl: "",
            role: isBootstrapAdminEmail(normalizedEmail)
              ? "admin"
              : "staff",
            active: true,
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(
            doc(db, "users", credential.user.uid),
            profile,
            { merge: true }
          );
        }
      } else {
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );
      }
    } catch (caught) {
      if (mode === "forgot-password") {
        const message = cleanFirebaseError(caught).toLowerCase();

        if (message.includes("invalid-email")) {
          setError("Enter a valid email address.");
        } else if (
          message.includes("too-many-requests") ||
          message.includes("too many requests")
        ) {
          setError(
            "Too many reset attempts. Wait a few minutes and try again."
          );
        } else if (
          message.includes("network-request-failed") ||
          message.includes("network")
        ) {
          setError(
            "Unable to connect. Check your internet connection and try again."
          );
        } else {
          // Keep the response generic so the screen does not reveal
          // whether a particular account exists.
          setSuccess(
            "When the email is registered, Firebase will send a password reset link. Check your inbox and spam folder."
          );
        }
      } else {
        setError(cleanFirebaseError(caught));
      }
    } finally {
      setLoading(false);
    }
  }

  const heading =
    mode === "login"
      ? "Sign in"
      : mode === "register"
        ? "Create your account"
        : "Recover your password";

  const description =
    mode === "forgot-password"
      ? "Enter the email connected to your RouteTrack account. Firebase will send a secure password reset link."
      : "Use your account to access your routing records.";

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-logo">
          <FileCheck2 size={30} />
        </div>

        <p className="eyebrow">DOCUMENT ROUTING MONITOR</p>

        <h1>
          Record a route in seconds and trace the last person who
          received it.
        </h1>

        <p className="auth-lead">
          Built for quick PRF, SRF, CRF, and PO monitoring with
          exact dates, times, people, departments, and a complete
          chain of custody.
        </p>

        <div className="auth-benefits">
          <div>
            <LockKeyhole size={20} />
            <span>
              Firebase-secured passwords and user accounts
            </span>
          </div>

          <div>
            <ShieldCheck size={20} />
            <span>Administrator and staff access</span>
          </div>

          <div>
            <Smartphone size={20} />
            <span>Optimized for phone and desktop use</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <p className="eyebrow">ROUTETRACK</p>

          <h2>
            {firebaseConfigured ? heading : "Try the system"}
          </h2>

          <p className="muted">
            {firebaseConfigured
              ? description
              : "Firebase is not configured. Demo data stays in this browser only."}
          </p>

          {firebaseConfigured ? (
            <form onSubmit={submit} className="stack-form">
              {mode === "register" && (
                <>
                  <label>
                    Full name
                    <input
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Department / office
                    <input
                      value={department}
                      onChange={(event) =>
                        setDepartment(event.target.value)
                      }
                      placeholder="Example: Student Assistant / Records"
                    />
                  </label>

                  <label>
                    Position
                    <input
                      value={position}
                      onChange={(event) =>
                        setPosition(event.target.value)
                      }
                    />
                  </label>
                </>
              )}

              <label>
                Email address
                <div className="password-field">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                  />

                  {mode === "forgot-password" && (
                    <span aria-hidden="true">
                      <Mail size={18} />
                    </span>
                  )}
                </div>
              </label>

              {mode !== "forgot-password" && (
                <label>
                  Password
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      minLength={6}
                      autoComplete={
                        mode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                      required
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>
              )}

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <div className="form-validation-summary" role="status">
                  <strong>Password recovery email requested.</strong>
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                className="primary-button full-button"
                disabled={loading}
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : "Send password reset email"}
              </button>

              {mode === "login" && (
                <>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      changeMode("forgot-password")
                    }
                  >
                    <KeyRound size={16} />
                    Forgot password?
                  </button>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => changeMode("register")}
                  >
                    No account yet? Create one
                  </button>
                </>
              )}

              {mode === "register" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => changeMode("login")}
                >
                  Already registered? Sign in
                </button>
              )}

              {mode === "forgot-password" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => changeMode("login")}
                >
                  <ArrowLeft size={16} />
                  Back to sign in
                </button>
              )}
            </form>
          ) : (
            <button
              className="primary-button full-button"
              onClick={() =>
                onDemo({
                  uid: "demo-admin",
                  email: "admin@demo.local",
                  displayName: "Demo Administrator",
                  department: "Student Assistant / Records",
                  position: "Administrator",
                  phone: "",
                  photoDataUrl: "",
                  role: "admin",
                  active: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  isDemo: true,
                })
              }
            >
              Open admin demo dashboard
            </button>
          )}

          <p className="auth-note">
            Passwords and recovery emails are handled by Firebase
            Authentication. RouteTrack does not save readable
            passwords or reset codes in Firestore.
          </p>
        </div>
      </section>
    </main>
  );
}