const APP_SW_PATH = "/sw.js";

function isPreviewHost(hostname: string) {
  return hostname.startsWith("id-preview--") || hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev");
}

async function removeAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((r) => new URL(r.active?.scriptURL || APP_SW_PATH, location.origin).pathname === APP_SW_PATH).map((r) => r.unregister()));
}

export async function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  const refused = !import.meta.env.PROD || window.self !== window.top || isPreviewHost(location.hostname) || new URLSearchParams(location.search).get("sw") === "off";
  if (refused) { await removeAppWorker(); return; }
  await navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" });
}