"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, Send, Smartphone } from "lucide-react";
import type { SessionUser } from "@/lib/types";
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushEnabledLocally,
  listenForForegroundPush,
  listenForPushRegistrationChanges,
  pushSupport,
  refreshPushRegistration,
  sendTestPush,
} from "@/lib/push-notifications";

export function PushNotificationSettings({
  user,
  notify,
}: {
  user: SessionUser;
  notify: (message: string, error?: boolean) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(isPushEnabledLocally() && typeof Notification !== "undefined" && Notification.permission === "granted");

    void pushSupport().then((result) => {
      setSupported(result.supported);
      setReason(result.reason || "");
    });

    const stopChanges = listenForPushRegistrationChanges();
    const stopForeground = listenForForegroundPush((payload) => {
      const title = payload.data?.title || payload.notification?.title || "New RouteTrack notification";
      notify(title);
    });

    void refreshPushRegistration(user).catch(() => undefined);

    return () => {
      stopChanges();
      stopForeground();
    };
  }, [user.uid]);

  async function enable() {
    setBusy(true);
    try {
      await enablePushNotifications(user);
      setEnabled(true);
      notify("Phone notifications enabled on this device.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to enable notifications.", true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await disablePushNotifications();
      setEnabled(false);
      notify("Phone notifications disabled on this device.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to disable notifications.", true);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await sendTestPush();
      notify("Test notification sent. Put RouteTrack in the background to test the phone alert.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to send the test notification.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="push-notification-settings">
      <div className="push-notification-copy">
        <div className={`push-status-icon ${enabled ? "push-enabled" : ""}`}>
          {enabled ? <CheckCircle2 size={18} /> : <Smartphone size={18} />}
        </div>
        <div>
          <strong>{enabled ? "Phone alerts are enabled" : "Messenger-style phone alerts"}</strong>
          <span>
            {supported === false
              ? reason
              : enabled
                ? "This device can receive messages and important document updates in the background."
                : "Enable lock-screen and notification-tray alerts for this device."}
          </span>
        </div>
      </div>

      {supported !== false && (
        <div className="push-notification-actions">
          {enabled ? (
            <>
              <button type="button" className="secondary-button compact-button" onClick={() => void test()} disabled={busy}>
                {busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />}
                Test
              </button>
              <button type="button" className="text-button compact-button" onClick={() => void disable()} disabled={busy}>
                <BellOff size={15} /> Disable
              </button>
            </>
          ) : (
            <button type="button" className="primary-button compact-button" onClick={() => void enable()} disabled={busy || supported === null}>
              {busy ? <Loader2 className="spin" size={15} /> : <Bell size={15} />}
              Enable phone alerts
            </button>
          )}
        </div>
      )}
    </section>
  );
}
