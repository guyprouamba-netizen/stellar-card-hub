import { useEffect, useState } from "react";
import { Download as DownloadIcon, CheckCircle2, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import logo from "@/assets/logo.png";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
}

function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "");
}

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

function isPreviewHost() {
  const h = typeof window !== "undefined" ? window.location.hostname : "";
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    h.endsWith(".beta.lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

export default function DownloadPage() {
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<null | "ios" | "iframe" | "desktop-manual">(null);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(!!standalone);

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => { setInstalled(true); setBusy(false); setHint(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Register a minimal SW in production only — required by Chrome desktop
    // to expose the install prompt. Never in Lovable preview or iframes.
    if (
      "serviceWorker" in navigator &&
      !isPreviewHost() &&
      !isInIframe() &&
      window.location.protocol === "https:"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) return;
    // iOS Safari does not expose a programmatic install API.
    if (isIOS()) { setHint("ios"); return; }

    if (!installEvt) {
      // Lovable preview / any iframe never fires beforeinstallprompt — open
      // the app in a real top-level window so the browser can install it.
      if (isInIframe()) {
        const url = window.location.href;
        try { window.top!.location.href = url; } catch { window.open(url, "_blank"); }
        setHint("iframe");
        return;
      }
      // On Android outside Chrome, jump into Chrome where the prompt works.
      if (isAndroid()) {
        const host = window.location.host;
        const path = window.location.pathname + window.location.search;
        window.location.href = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
        return;
      }
      // Desktop without prompt yet — show the browser-address-bar hint.
      setHint("desktop-manual");
      return;
    }

    try {
      setBusy(true);
      installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice?.outcome !== "accepted") setBusy(false);
      setInstallEvt(null);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <img src={logo} alt="FASO INVEST PAY" className="h-24 w-24 rounded-3xl shadow-glow" />
        <h1 className="mt-6 font-[Space_Grotesk] text-3xl font-bold">FASO INVEST PAY</h1>
        <p className="mt-2 text-sm text-muted-foreground">Application mobile officielle</p>

        {installed ? (
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-500">
            <CheckCircle2 className="h-5 w-5" /> Déjà installée sur votre appareil
          </div>
        ) : (
          <button
            onClick={install}
            disabled={busy}
            className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-4 text-base font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <DownloadIcon className="h-5 w-5" />}
            {busy ? "Installation…" : "Télécharger"}
          </button>
        )}

        {hint === "ios" && (
          <div className="mt-6 w-full rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-left text-sm">
            <p className="font-semibold text-sky-500">Sur iPhone, l'installation directe n'est pas autorisée par Apple.</p>
            <p className="mt-2 text-muted-foreground">Appuyez sur l'icône <b>Partager</b> ⬆︎ en bas de Safari, puis <b>« Sur l'écran d'accueil »</b>.</p>
          </div>
        )}

        {hint === "iframe" && (
          <div className="mt-6 w-full rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left text-sm">
            <p className="font-semibold text-primary">Ouverture de l'application…</p>
            <p className="mt-2 text-muted-foreground">
              L'installation ne fonctionne pas dans un aperçu intégré. Nous ouvrons l'app dans un nouvel onglet — cliquez de nouveau sur <b>Télécharger</b>.
            </p>
          </div>
        )}

        {hint === "desktop-manual" && (
          <div className="mt-6 w-full rounded-2xl border border-border bg-card p-4 text-left text-sm">
            <p className="font-semibold">Installation manuelle</p>
            <p className="mt-2 text-muted-foreground">
              Dans la barre d'adresse de votre navigateur, cliquez sur l'icône <b>⊕ Installer</b> (à droite de l'URL), ou ouvrez le menu <b>⋮</b> → <b>« Installer FASO INVEST PAY »</b>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}