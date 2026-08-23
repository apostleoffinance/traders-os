import { api } from "@/lib/api";

type PushConfig = {
  available: boolean;
  vapid_public_key: string | null;
  reminder_hour: number;
  message: string | null;
};

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function loadPushConfig(): Promise<PushConfig> {
  return api<PushConfig>("/api/push/config");
}

export async function enableJournalReminders(): Promise<void> {
  if (!pushSupported()) {
    throw new Error("Web notifications are not available in this browser.");
  }
  const cfg = await loadPushConfig();
  if (!cfg.available || !cfg.vapid_public_key) {
    throw new Error(cfg.message || "Journal reminders are not configured on the server.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications were blocked. Enable them in the browser settings, then try again.");
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.vapid_public_key),
    }));
  const raw = sub.toJSON();
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    throw new Error("The browser did not return a complete push subscription.");
  }
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: raw.endpoint,
      keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
    }),
  });
}

export async function disableJournalReminders(): Promise<void> {
  if (pushSupported()) {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  }
  await api("/api/push/subscribe", { method: "DELETE" });
}
