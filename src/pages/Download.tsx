import { useEffect, useState } from "react";
import { Apple, Smartphone, Download as DownloadIcon, ShieldCheck, Zap, CheckCircle2, ArrowRight, Share, Plus } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import logo from "@/assets/logo.png";

type Device = "android" | "ios" | "desktop";

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)) return "ios";
  return "desktop";
}

export default function DownloadPage() {
  const [device, setDevice] = useState<Device>("desktop");
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(!!standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice?.outcome === "accepted") setInstalled(true);
    setInstallEvt(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="container mx-auto px-4 py-12 sm:px-6 md:py-20">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <DownloadIcon className="h-3 w-3" /> Application FASO-INVEST PAY
          </span>
          <h1 className="mt-6 font-[Space_Grotesk] text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Installez FASO-INVEST PAY <br />sur votre téléphone
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Accédez plus vite au transfert inter-réseaux, à vos cartes virtuelles et à vos paiements — directement depuis l'écran d'accueil de votre téléphone.
          </p>
        </div>

        {/* Detected card */}
        <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-card-premium md:p-10">
          <div className="flex flex-col items-center gap-6 text-center">
            <img src={logo} alt="FASO-INVEST PAY" className="h-20 w-20 rounded-2xl shadow-glow" />
            {installed ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Application déjà installée
                </div>
                <p className="text-sm text-muted-foreground">
                  Vous utilisez déjà la version installée. Lancez-la depuis votre écran d'accueil.
                </p>
              </>
            ) : device === "android" ? (
              <AndroidInstall installEvt={installEvt} triggerInstall={triggerInstall} />
            ) : device === "ios" ? (
              <IosInstall />
            ) : (
              <DesktopInstall installEvt={installEvt} triggerInstall={triggerInstall} />
            )}
          </div>

          {/* Device switcher */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
            <span className="mr-2">Voir les instructions pour :</span>
            {(["android", "ios", "desktop"] as Device[]).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`rounded-full border px-3 py-1 font-semibold transition ${
                  device === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                {d === "android" ? "Android" : d === "ios" ? "iPhone / iPad" : "Ordinateur"}
              </button>
            ))}
          </div>
        </div>

        {/* Advantages */}
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, t: "Accès rapide", d: "Ouvre en un clic depuis l'écran d'accueil, comme une vraie appli." },
            { icon: ShieldCheck, t: "Sécurisé", d: "Même sécurité que le site : sessions chiffrées et signatures HMAC." },
            { icon: Smartphone, t: "Plein écran", d: "Sans barre d'adresse — expérience mobile fluide et immersive." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-[Space_Grotesk] text-base font-bold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          Note : une version native Play Store & App Store est en préparation. En attendant, cette application web installable offre 100% des fonctionnalités.
        </p>
      </main>
    </div>
  );
}

function AndroidInstall({ installEvt, triggerInstall }: { installEvt: any; triggerInstall: () => void }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">
        <Smartphone className="h-3 w-3" /> Android détecté
      </div>
      <h2 className="font-[Space_Grotesk] text-2xl font-bold">Installer sur Android</h2>
      {installEvt ? (
        <button
          onClick={triggerInstall}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow"
        >
          <DownloadIcon className="h-5 w-5" /> Télécharger l'application
        </button>
      ) : (
        <ol className="w-full max-w-sm space-y-3 text-left text-sm text-muted-foreground">
          <Step n={1}>Ouvrez cette page dans <b>Chrome</b> ou <b>Samsung Internet</b>.</Step>
          <Step n={2}>Appuyez sur le menu (les 3 points en haut à droite).</Step>
          <Step n={3}>Choisissez « <b>Installer l'application</b> » ou « Ajouter à l'écran d'accueil ».</Step>
          <Step n={4}>Confirmez — l'icône FasoPay apparaît sur votre écran d'accueil.</Step>
        </ol>
      )}
    </>
  );
}

function IosInstall() {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sky-500">
        <Apple className="h-3 w-3" /> iPhone / iPad détecté
      </div>
      <h2 className="font-[Space_Grotesk] text-2xl font-bold">Installer sur iPhone</h2>
      <ol className="w-full max-w-sm space-y-3 text-left text-sm text-muted-foreground">
        <Step n={1}>Ouvrez cette page dans <b>Safari</b> (obligatoire sur iOS).</Step>
        <Step n={2}>
          Appuyez sur l'icône <Share className="inline h-4 w-4 -mt-0.5" /> <b>Partager</b> en bas de l'écran.
        </Step>
        <Step n={3}>
          Faites défiler puis choisissez <b>« Sur l'écran d'accueil »</b> <Plus className="inline h-4 w-4 -mt-0.5" />.
        </Step>
        <Step n={4}>Appuyez sur « Ajouter » — FasoPay s'installe comme une vraie appli.</Step>
      </ol>
    </>
  );
}

function DesktopInstall({ installEvt, triggerInstall }: { installEvt: any; triggerInstall: () => void }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <DownloadIcon className="h-3 w-3" /> Ordinateur détecté
      </div>
      <h2 className="font-[Space_Grotesk] text-2xl font-bold">Installer sur ordinateur</h2>
      {installEvt ? (
        <button
          onClick={triggerInstall}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow"
        >
          <DownloadIcon className="h-5 w-5" /> Installer l'application
        </button>
      ) : (
        <p className="max-w-sm text-sm text-muted-foreground">
          Dans <b>Chrome</b> ou <b>Edge</b>, cliquez sur l'icône d'installation à droite de la barre d'adresse, ou ouvrez le menu ⋮ → « Installer FASO-INVEST PAY ».
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Vous pouvez aussi ouvrir cette page depuis votre téléphone pour installer la version mobile.
      </p>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

// Ensure ArrowRight import isn't tree-shaken accidentally.
void ArrowRight;