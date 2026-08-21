// Web Push subscribe/unsubscribe helpers for the header bell (PushBell.js).
// Every function is a safe no-op (returns false/null) when the browser lacks
// the Push API or the server has no VAPID key configured, so the bell can
// call these unconditionally and just branch on the result.
import { getPushVapidKey, postPushSubscribe, postPushUnsubscribe } from "./api";

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// The browser wants the VAPID key as a Uint8Array, but our API/DB store it
// base64url-encoded (see scripts/gen_vapid_keys.py).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

let registrationPromise = null;

export function registerServiceWorker() {
  if (!isPushSupported()) return Promise.resolve(null);
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
      registrationPromise = null;
      return null;
    });
  }
  return registrationPromise;
}

// Current status: "unsupported" | "subscribed" | "unsubscribed". Doesn't
// distinguish Notification.permission "denied" from "default" — the bell
// treats both as "unsubscribed" and lets the browser's own prompt/settings
// UI explain a denial when the user clicks it.
//
// When a subscription already exists, this also silently re-POSTs it to the
// server (fire-and-forget). The browser can end up holding a PushSubscription
// whose p256dh/auth no longer match what's stored server-side (e.g. the push
// registration got refreshed independently of our subscribe button) — when
// that happens the server's encrypted payloads fail to decrypt and the
// browser drops them before the service worker's "push" handler ever runs,
// so the user looks subscribed but silently gets nothing. Resyncing on every
// load is cheap (upsert on endpoint) and self-heals that drift.
export async function getPushStatus(loc, lang) {
  if (!isPushSupported()) return "unsupported";
  const reg = await registerServiceWorker();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return "unsubscribed";
  postPushSubscribe(sub.toJSON(), loc ? loc.lat : null, loc ? loc.lon : null, lang).catch(() => {});
  return "subscribed";
}

export async function subscribeToPush(loc, lang) {
  if (!isPushSupported()) return false;

  const key = await getPushVapidKey();
  if (!key) return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  await postPushSubscribe(sub.toJSON(), loc ? loc.lat : null, loc ? loc.lon : null, lang);
  return true;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await postPushUnsubscribe(endpoint);
  return true;
}
