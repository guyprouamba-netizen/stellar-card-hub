// Minimal service worker — required by Chromium to expose the "Install app"
// prompt on desktop. We intentionally do NOT cache anything (no offline mode).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* pass-through */ });