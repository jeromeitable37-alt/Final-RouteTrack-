"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MoreVertical, Share2, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true;
}

function isIos(): boolean {
  return typeof window !== "undefined" && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setInstalled(isInstalled());
    const media = window.matchMedia("(display-mode: standalone)");

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setMessage("RouteTrack was installed successfully.");
      setOpen(true);
    };
    const onDisplayModeChange = () => setInstalled(isInstalled());

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  async function install() {
    if (installed) {
      setMessage("RouteTrack is already installed on this device.");
      setOpen(true);
      return;
    }

    if (!promptEvent) {
      setMessage("");
      setOpen(true);
      return;
    }

    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "dismissed") {
        setMessage("Installation was cancelled. You can try again anytime.");
        setOpen(true);
      }
    } catch {
      setMessage("The browser could not open the installer. Follow the manual steps below.");
      setOpen(true);
    } finally {
      setBusy(false);
      setPromptEvent(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className="secondary-button top-install-app-button"
        onClick={() => void install()}
        disabled={busy}
        title={installed ? "RouteTrack is installed" : "Install RouteTrack on this device"}
        aria-label={installed ? "RouteTrack is installed" : "Install RouteTrack app"}
        style={{ minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, whiteSpace: "nowrap", paddingInline: 12, borderRadius: 12 }}
      >
        {installed ? <CheckCircle2 size={17} /> : <Download size={17} />}
        <span>{busy ? "Opening…" : installed ? "Installed" : "Install App"}</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 16, background: "rgba(15,23,42,.58)", backdropFilter: "blur(6px)" }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(440px,100%)", border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", color: "var(--text)", boxShadow: "0 24px 80px rgba(15,23,42,.28)", overflow: "hidden" }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 13, background: "var(--primary-soft)", color: "var(--primary)" }}>
                <Smartphone size={21} />
              </span>
              <div style={{ flex: 1 }}>
                <strong id="install-title" style={{ display: "block", fontSize: 17 }}>Install RouteTrack</strong>
                <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 13 }}>Add the system to your device like a regular app.</span>
              </div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close install instructions" style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 11 }}>
                <X size={18} />
              </button>
            </header>

            <div style={{ padding: 20 }}>
              {message && <p style={{ margin: "0 0 16px", padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-soft)", lineHeight: 1.45 }}>{message}</p>}

              {installed ? (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <CheckCircle2 size={22} style={{ color: "#16a34a", flexShrink: 0 }} />
                  <div>
                    <strong>RouteTrack is already installed.</strong>
                    <p style={{ margin: "5px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>Open it using the RouteTrack icon on your home screen, app drawer, Start menu, or desktop.</p>
                  </div>
                </div>
              ) : isIos() ? (
                <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 13, lineHeight: 1.5 }}>
                  <li>Open RouteTrack using Safari.</li>
                  <li>Tap the <Share2 size={15} style={{ display: "inline" }} /> Share button.</li>
                  <li>Select <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong>.</li>
                </ol>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 13, lineHeight: 1.5 }}>
                  <li>Open the browser menu <MoreVertical size={16} style={{ display: "inline" }} />.</li>
                  <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                  <li>Confirm by tapping or clicking <strong>Install</strong>.</li>
                </ol>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function PwaSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register("/firebase-messaging-sw").catch((error) => {
        console.error("RouteTrack service-worker registration failed:", error);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
