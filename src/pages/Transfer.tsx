import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Send, Wallet, QrCode, CheckCircle2, Clock, Loader2, RefreshCw,
  ArrowDownLeft, ArrowUpRight, Copy, X, Phone, User as UserIcon,
  ScanLine, Camera, Image as ImageIcon,
} from "lucide-react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import {
  initInternalTransfer, listMyInternalTransfers, lookupInternalRecipient,
} from "@/lib/transfer.functions";

const C = {
  bg: "#f5f0e0",
  cream: "#f9f7f0",
  ink: "#064e3b",
  green: "#0d7a5f",
  gold: "#c9a84c",
  border: "#e2decb",
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string; Icon: any }> = {
    delivered: { label: "Livré", bg: "bg-emerald-100", fg: "text-emerald-700", Icon: CheckCircle2 },
    claimed:   { label: "Récupéré", bg: "bg-emerald-100", fg: "text-emerald-700", Icon: CheckCircle2 },
    pending_claim: { label: "En attente d'inscription", bg: "bg-amber-100", fg: "text-amber-700", Icon: Clock },
    cancelled: { label: "Annulé", bg: "bg-slate-100", fg: "text-slate-600", Icon: X },
  };
  const s = map[status] || map.delivered;
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.fg}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

function useMe() {
  return useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) throw new Error("Non connecté");
      const [{ data: prof }, { data: wallets }] = await Promise.all([
        supabase.from("profiles").select("full_name,phone,email").eq("id", uid).maybeSingle(),
        supabase.from("wallets").select("currency,balance").eq("user_id", uid),
      ]);
      const xof = Number((wallets || []).find((w: any) => w.currency === "XOF")?.balance || 0);
      return { uid, profile: prof, xofBalance: xof };
    },
    refetchInterval: 15_000,
  });
}

export default function TransferPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const meQ = useMe();
  const listQ = useQuery({
    queryKey: ["itr-list"],
    queryFn: listMyInternalTransfers,
    refetchInterval: 15_000,
  });

  const [form, setForm] = useState({
    recipient_phone: params.get("to") || "",
    recipient_name: params.get("name") || "",
    amount: params.get("amount") || "",
    note: "",
  });
  const [lookup, setLookup] = useState<{ found: boolean; name?: string | null } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [myQrDataUrl, setMyQrDataUrl] = useState<string>("");

  // Live lookup by phone
  useEffect(() => {
    let cancel = false;
    const raw = form.recipient_phone.replace(/\D/g, "");
    if (raw.length < 8) { setLookup(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await lookupInternalRecipient(form.recipient_phone);
        if (!cancel) {
          setLookup(r);
          if (r.found && r.name && !form.recipient_name) {
            setForm((f) => ({ ...f, recipient_name: r.name || "" }));
          }
        }
      } catch { /* ignore */ }
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [form.recipient_phone]);

  // Clear URL params once consumed
  useEffect(() => {
    if (params.get("to") || params.get("amount") || params.get("name")) {
      const p = new URLSearchParams(params);
      p.delete("to"); p.delete("amount"); p.delete("name");
      setParams(p, { replace: true });
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountNum = Math.floor(Number(form.amount) || 0);
  const me = meQ.data;
  const xofBalance = me?.xofBalance ?? 0;

  const valid = useMemo(() => {
    return form.recipient_phone.replace(/\D/g, "").length >= 8
      && amountNum >= 100
      && xofBalance >= amountNum;
  }, [form, amountNum, xofBalance]);

  const sendMut = useMutation({
    mutationFn: () => initInternalTransfer({
      recipient_phone: form.recipient_phone,
      recipient_name: form.recipient_name,
      amount: amountNum,
      note: form.note,
    }),
    onSuccess: (res: any) => {
      if (res?.ok === false) { toast.error(res.error || "Erreur"); return; }
      if (res.delivered) toast.success(`✅ ${amountNum.toLocaleString("fr-FR")} XOF envoyés instantanément`);
      else toast.success(`Transfert en attente — le destinataire recevra ${amountNum.toLocaleString("fr-FR")} XOF dès son inscription`);
      qc.invalidateQueries({ queryKey: ["itr-list"] });
      qc.invalidateQueries({ queryKey: ["me-profile"] });
      setForm({ recipient_phone: "", recipient_name: "", amount: "", note: "" });
      setLookup(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const myPhone = me?.profile?.phone || "";
  const myShareUrl = myPhone
    ? `${window.location.origin}/transfer?to=${encodeURIComponent(myPhone)}${me?.profile?.full_name ? `&name=${encodeURIComponent(me.profile.full_name)}` : ""}`
    : "";

  // Génération QR 100% locale (fonctionne hors ligne, s'affiche même sans réseau).
  useEffect(() => {
    let cancel = false;
    if (!myShareUrl) { setMyQrDataUrl(""); return; }
    QRCode.toDataURL(myShareUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
      color: { dark: "#064e3b", light: "#f9f7f0" },
    }).then((u) => { if (!cancel) setMyQrDataUrl(u); }).catch(() => {});
    return () => { cancel = true; };
  }, [myShareUrl]);

  // Parse d'un contenu scanné (URL /transfer?to=…&name=… ou simple numéro).
  function applyScanned(raw: string) {
    if (!raw) return;
    try {
      let phone = "";
      let name = "";
      let amount = "";
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const u = new URL(raw);
        phone = u.searchParams.get("to") || "";
        name = u.searchParams.get("name") || "";
        amount = u.searchParams.get("amount") || "";
      } else if (/^\+?\d[\d\s]{6,}$/.test(raw.trim())) {
        phone = raw.trim();
      } else {
        toast.error("QR code non reconnu");
        return;
      }
      if (!phone) { toast.error("QR sans numéro"); return; }
      setForm((f) => ({
        ...f,
        recipient_phone: phone,
        recipient_name: name || f.recipient_name,
        amount: amount || f.amount,
      }));
      setShowScan(false);
      toast.success("Bénéficiaire chargé depuis le QR");
    } catch {
      toast.error("QR invalide");
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: C.bg, color: C.ink, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div className="max-w-5xl mx-auto space-y-6">

        <BackButton to="/dashboard" className="mb-2 !text-[#064e3b] hover:!text-[#0d7a5f]" />

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
              Envoyer de l'argent
            </h1>
            <p className="mt-2 text-sm font-medium" style={{ color: C.green }}>
              Transferts <b>gratuits & instantanés</b> entre comptes FASO INVEST PAY. Même si le destinataire n'a pas encore de compte, il recevra un SMS pour récupérer son argent.
            </p>
          </div>
          <button
            onClick={() => setShowQr(true)}
            disabled={!myPhone}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm disabled:opacity-40"
            style={{ backgroundColor: C.ink, color: C.gold }}
          >
            <QrCode className="h-4 w-4" /> Mon QR Code
          </button>
        </header>

        <div className="grid lg:grid-cols-5 gap-6 items-start">
          {/* FORM */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl overflow-hidden" style={{ borderColor: C.border, borderWidth: 1 }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: C.ink }}>
              <h2 className="text-white text-lg" style={{ fontFamily: "'Libre Baskerville', serif" }}>Nouveau transfert</h2>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded" style={{ color: C.ink, backgroundColor: C.gold }}>
                Gratuit
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Balance */}
              <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: C.border, backgroundColor: C.cream }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: C.ink, color: C.gold }}>
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Portefeuille XOF</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color: C.ink }}>
                      {xofBalance.toLocaleString("fr-FR")} XOF
                    </p>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Phone className="inline h-3 w-3 mr-1" />
                    Numéro du destinataire
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowScan(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: C.gold, color: C.ink }}
                  >
                    <ScanLine className="h-3.5 w-3.5" /> Scanner un QR
                  </button>
                </div>
                <input
                  type="tel"
                  value={form.recipient_phone}
                  onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                  placeholder="70 00 00 00"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:outline-none text-lg font-mono"
                  style={{ color: C.ink }}
                />
                {lookup && (
                  <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${lookup.found ? "text-emerald-700" : "text-amber-700"}`}>
                    {lookup.found ? (
                      <><CheckCircle2 className="h-4 w-4" /> Compte FASO INVEST PAY trouvé{lookup.name ? ` — ${lookup.name}` : ""}. Livraison instantanée.</>
                    ) : (
                      <><Clock className="h-4 w-4" /> Pas de compte détecté. Le destinataire recevra un SMS pour créer son compte gratuit et récupérer l'argent.</>
                    )}
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  <UserIcon className="inline h-3 w-3 mr-1" />
                  Nom du destinataire (facultatif)
                </label>
                <input
                  type="text"
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                  placeholder="Ex. Awa Ouédraogo"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:outline-none text-sm"
                  style={{ color: C.ink }}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Montant (XOF)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })}
                  placeholder="5 000"
                  className="w-full px-4 py-4 rounded-lg border border-slate-200 focus:ring-2 focus:outline-none text-2xl font-bold tabular-nums"
                  style={{ color: C.ink }}
                />
                <div className="mt-2 flex gap-2 flex-wrap">
                  {[500, 1000, 2500, 5000, 10000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm({ ...form, amount: String(v) })}
                      className="px-3 py-1 rounded-full text-xs font-bold border"
                      style={{ borderColor: C.border, color: C.green, backgroundColor: "white" }}
                    >
                      +{v.toLocaleString("fr-FR")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Message (facultatif)
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 200) })}
                  placeholder="Merci pour ton aide"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:outline-none text-sm"
                  style={{ color: C.ink }}
                />
              </div>

              <div className="p-3 rounded-lg text-xs flex items-start gap-2" style={{ backgroundColor: C.cream, borderColor: C.border, borderWidth: 1, color: C.ink }}>
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: C.green }}>i</div>
                <p>
                  <b>0 F de frais.</b> Le montant est débité de votre portefeuille XOF et crédité instantanément au bénéficiaire. Un SMS le notifie automatiquement.
                </p>
              </div>

              <button
                disabled={!valid || sendMut.isPending}
                onClick={() => sendMut.mutate()}
                className="w-full py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:transform-none disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: C.ink, color: C.gold }}
              >
                {sendMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Envoyer {amountNum ? `${amountNum.toLocaleString("fr-FR")} XOF` : ""}
              </button>
            </div>
          </div>

          {/* SIDE — QR share */}
          <aside className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6 space-y-4" style={{ borderColor: C.border, borderWidth: 1 }}>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5" style={{ color: C.gold }} />
              <h3 className="font-bold" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
                Recevoir par QR Code
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Partagez votre QR code : un expéditeur le scanne avec l'appareil photo de son téléphone et le formulaire se remplit automatiquement.
            </p>
            {myPhone ? (
              <>
                <div className="flex justify-center p-4 rounded-xl" style={{ backgroundColor: C.cream, borderColor: C.border, borderWidth: 1 }}>
                  {myQrDataUrl
                    ? <img src={myQrDataUrl} alt="Mon QR Code" width={200} height={200} className="rounded" />
                    : <div className="h-[200px] w-[200px] grid place-items-center text-xs text-slate-400">Génération…</div>}
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Mon numéro</p>
                  <p className="text-lg font-mono font-bold" style={{ color: C.ink }}>{myPhone}</p>
                </div>
                <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                  Ce QR est généré sur votre appareil — il reste affichable même sans connexion internet.
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(myShareUrl);
                    toast.success("Lien copié");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold border"
                  style={{ borderColor: C.border, color: C.green, backgroundColor: "white" }}
                >
                  <Copy className="h-3 w-3" /> Copier mon lien de paiement
                </button>
              </>
            ) : (
              <div className="p-4 rounded-lg text-xs text-amber-700 bg-amber-50">
                Ajoutez votre numéro de téléphone dans votre profil pour générer votre QR code.
              </div>
            )}
          </aside>
        </div>

        {/* HISTORY */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ borderColor: C.border, borderWidth: 1 }}>
          <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: C.bg }}>
            <h2 className="font-bold text-lg" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
              Historique
            </h2>
            <button onClick={() => listQ.refetch()} className="inline-flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: C.green }}>
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
          <TransfersHistory data={listQ.data} />
        </section>
      </div>

      {/* QR MODAL */}
      {showQr && myPhone && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowQr(false)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-bold text-xl mb-1 text-center" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
              Recevoir de l'argent
            </h3>
            <p className="text-xs text-center text-slate-500 mb-4">Faites scanner ce QR pour recevoir un paiement instantané.</p>
            <div className="flex justify-center p-6 rounded-xl" style={{ backgroundColor: C.cream }}>
              {myQrDataUrl
                ? <img src={myQrDataUrl} alt="QR" className="rounded" width={320} height={320} />
                : <div className="h-[320px] w-[320px] grid place-items-center text-xs text-slate-400">Génération…</div>}
            </div>
            <div className="text-center mt-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Numéro</p>
              <p className="text-2xl font-mono font-bold" style={{ color: C.ink }}>{myPhone}</p>
            </div>
          </div>
        </div>
      )}

      {showScan && (
        <QrScanModal onClose={() => setShowScan(false)} onResult={applyScanned} />
      )}
    </div>
  );
}

function QrScanModal({ onClose, onResult }: { onClose: () => void; onResult: (v: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"camera" | "photo">("camera");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (mode !== "camera") return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();

        const canvas = canvasRef.current || document.createElement("canvas");
        canvasRef.current = canvas;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const tick = () => {
          if (stopped) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
            if (code?.data) {
              stopped = true;
              onResult(code.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setError(e?.message || "Caméra indisponible");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, onResult]);

  async function handleFile(file: File) {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
      URL.revokeObjectURL(url);
      if (code?.data) onResult(code.data);
      else toast.error("Aucun QR détecté dans l'image");
    } catch {
      toast.error("Impossible de lire l'image");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
        <h3 className="font-bold text-lg mb-1 text-center" style={{ fontFamily: "'Libre Baskerville', serif", color: C.ink }}>
          Scanner un QR code
        </h3>
        <p className="text-xs text-center text-slate-500 mb-4">
          Pointez la caméra sur le QR du bénéficiaire ou importez une photo.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-full" style={{ backgroundColor: C.cream }}>
          <button
            onClick={() => setMode("camera")}
            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold"
            style={mode === "camera" ? { backgroundColor: C.ink, color: C.gold } : { color: C.ink }}
          >
            <Camera className="h-3.5 w-3.5" /> Caméra
          </button>
          <button
            onClick={() => setMode("photo")}
            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold"
            style={mode === "photo" ? { backgroundColor: C.ink, color: C.gold } : { color: C.ink }}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Photo
          </button>
        </div>

        {mode === "camera" ? (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 border-2 rounded-2xl" style={{ borderColor: C.gold }} />
            {error && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 text-white text-xs p-4 text-center">
                {error}
                <br />
                Basculez sur « Photo » pour importer une image du QR.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: C.cream, borderColor: C.border, borderWidth: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm"
              style={{ backgroundColor: C.ink, color: C.gold }}
            >
              <ImageIcon className="h-4 w-4" /> Choisir une photo
            </button>
            <p className="text-[11px] text-slate-500 mt-3">
              Prenez une photo du QR ou choisissez-en une dans votre galerie.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TransfersHistory({ data }: { data?: { sent: any[]; received: any[] } }) {
  const rows = useMemo(() => {
    const s = (data?.sent || []).map((r) => ({ ...r, _dir: "out" as const }));
    const r = (data?.received || []).map((x) => ({ ...x, _dir: "in" as const }));
    return [...s, ...r].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [data]);

  if (!rows.length) {
    return <div className="py-12 text-center text-xs text-slate-400">Aucun transfert pour le moment.</div>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((r: any) => {
        const isOut = r._dir === "out";
        const other = isOut
          ? (r.recipient_name || r.recipient?.full_name || r.recipient_phone)
          : (r.sender?.full_name || "Expéditeur");
        return (
          <div key={`${r._dir}-${r.id}`} className="px-6 py-4 flex items-center gap-3 hover:bg-slate-50">
            <span className={`grid h-10 w-10 place-items-center rounded-full flex-shrink-0 ${isOut ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
              {isOut ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm" style={{ color: C.ink }}>
                  {isOut ? "Envoyé à" : "Reçu de"} {other}
                </span>
                <StatusPill status={r.status} />
              </div>
              <div className="text-[11px] text-slate-500">
                {new Date(r.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                {r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            <div className={`text-right font-bold tabular-nums ${isOut ? "text-red-600" : "text-emerald-700"}`}>
              {isOut ? "-" : "+"}{Number(r.amount).toLocaleString("fr-FR")} <span className="text-[10px] font-normal">{r.currency}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}