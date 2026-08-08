const APP_SW_PATH = "/sw.js";
const BUILD_KEY = "fasopay:build";
const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? String(__BUILD_ID__);

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

/**
 * Purge les caches hors ligne dès qu'une nouvelle version du code est servie,
 * pour éviter qu'un ancien bundle reste affiché après une mise à jour.
 */
async function purgeStaleBuild() {
  try {
    const previous = localStorage.getItem(BUILD_KEY);
    if (previous === BUILD_ID) return false;
    localStorage.setItem(BUILD_KEY, BUILD_ID);
    if (!previous) return false;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    return true;
  } catch {
    return false;
  }
}

export async function registerOfflineApp() {
  const purged = await purgeStaleBuild();
  if (!("serviceWorker" in navigator)) return;
  const refused = !import.meta.env.PROD || window.self !== window.top || isPreviewHost(location.hostname) || new URLSearchParams(location.search).get("sw") === "off";
  if (refused) { await removeAppWorker(); return; }
  const registration = await navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" });
  // Recharge automatiquement quand un nouveau service worker prend la main.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  void registration.update();
  if (purged) location.reload();
}