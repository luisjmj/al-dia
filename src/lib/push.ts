// Suscripción a Web Push desde el navegador.
// Registra el service worker, pide permiso y guarda la suscripción en Supabase.
import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

// ¿El navegador soporta Web Push?
export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permission(): NotificationPermission {
  return pushSupported() ? Notification.permission : "denied";
}

// base64url -> Uint8Array (formato que espera applicationServerKey)
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.error("No se pudo registrar el service worker:", e);
    return null;
  }
}

// ¿Este dispositivo ya está suscrito?
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

// Pide permiso, crea la suscripción y la guarda en la BD. Devuelve true si quedó activa.
export async function subscribe(
  userId: string,
  householdId: string
): Promise<boolean> {
  if (!pushSupported() || !supabase) return false;
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Falta VITE_VAPID_PUBLIC_KEY");
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      household_id: householdId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return true;
}

// Cancela la suscripción en este dispositivo y la borra de la BD.
export async function unsubscribe(): Promise<void> {
  if (!pushSupported() || !supabase) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
