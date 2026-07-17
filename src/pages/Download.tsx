import { useEffect, useState } from "react";
import { Download as DownloadIcon, CheckCircle2, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
}

export default function DownloadPage() {
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(!!standalone);

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => { setInstalled(true); setBusy(false); toast.success("Application installée sur votre écran d'accueil"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) return;
    // iOS Safari does not expose a programmatic install API.
    if (isIOS()) { setShowIosHint(true); return; }

    if (!installEvt) {
      // Try to open in Chrome on Android (works when opened from another browser/webview).
      if (/android/i.test(navigator.userAgent)) {
        const host = window.location.host;
        const path = window.location.pathname + window.location.search;
        window.location.href = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
        return;
      }
      toast.error("Ouvrez cette page dans Chrome, Edge ou Samsung Internet pour installer l'application.");
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
        <img src={logo} alt="FASO-INVEST PAY" className="h-24 w-24 rounded-3xl shadow-glow" />
        <h1 className="mt-6 font-[Space_Grotesk] text-3xl font-bold">FASO-INVEST PAY</h1>
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

        {showIosHint && (
          <div className="mt-6 w-full rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-left text-sm">
            <p className="font-semibold text-sky-500">Sur iPhone, l'installation directe n'est pas autorisée par Apple.</p>
            <p className="mt-2 text-muted-foreground">Appuyez sur l'icône <b>Partager</b> ⬆︎ en bas de Safari, puis <b>« Sur l'écran d'accueil »</b>.</p>
          </div>
        )}
      </main>
    </div>
  );
}