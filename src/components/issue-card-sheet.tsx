import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ArrowRight, Check, AlertTriangle, CreditCard, Wallet, Upload, Image as ImageIcon } from "lucide-react";
import { cardApi, walletApi } from "@/lib/api";
import { prepareIdImageForIssuer } from "@/lib/upload";

type Brand = "visa" | "mastercard";
const MIN_INITIAL_FUND_USD = 3;
const FUND_PRESETS = [3, 5, 10, 25, 50, 100];

type Form = {
  firstName: string; lastName: string; otherNames: string; email: string; dob: string;
  idType: "national_id" | "passport" | "drivers_license" | "NIN" | "BVN";
  idNumber: string; phone: string;
  line1: string; city: string; state: string; postalCode: string; country: string;
};

const DEFAULT_FORM: Form = {
  firstName: "", lastName: "", otherNames: "", email: "", dob: "", idType: "national_id",
  idNumber: "", phone: "",
  // Adresse de facturation officielle Faso-Invest (Miami) — pré-remplie pour
  // accélérer l'émission. L'utilisateur peut toujours la modifier.
  line1: "3401 N. Miami Ave, Ste 230",
  city: "Miami",
  state: "FL",
  postalCode: "33127",
  country: "USA",
};

export function IssueCardSheet({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued?: () => void }) {
  const [brand, setBrand] = useState<Brand>("visa");
  const [amount, setAmount] = useState<number>(MIN_INITIAL_FUND_USD);
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [checking, setChecking] = useState(false);
  const [afford, setAfford] = useState<{ can_afford: boolean; required: number; available: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idImageBack, setIdImageBack] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const backFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);
    setError(null);
    walletApi.canAffordCard(amount, "USD")
      .then((res) => { if (!cancelled) setAfford(res.data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Vérification du solde impossible"); })
      .finally(() => !cancelled && setChecking(false));
    return () => { cancelled = true; };
  }, [open, amount]);

  function setField<K extends keyof Form>(k: K, v: Form[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function pickIdImage(file?: File | null, side: "front" | "back" = "front") {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const imageData = await prepareIdImageForIssuer(file);
      if (side === "front") {
        setIdImage(imageData);
        setIdPreview(URL.createObjectURL(file));
      } else {
        setIdImageBack(imageData);
        setIdBackPreview(URL.createObjectURL(file));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Téléversement de la pièce impossible");
    } finally {
      setUploading(false);
    }
  }

  function validate(): string | null {
    if (!form.firstName.trim() || !form.lastName.trim()) return "Prénom et nom requis";
    if (!Number.isFinite(amount) || amount < MIN_INITIAL_FUND_USD) return "La recharge initiale minimum est de 3 USD";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dob)) return "Date de naissance requise (AAAA-MM-JJ)";
    if (!form.idNumber.trim()) return "Numéro de pièce requis";
    if (["NIN", "BVN", "national_id"].includes(form.idType) && !/^\d{11}$/.test(form.idNumber.trim())) {
      return "Ce type de pièce exige un numéro de 11 chiffres (sinon choisissez Passeport)";
    }
    if (!idImage) return "Photo de la pièce d'identité requise (exigée par le nouvel émetteur)";
    if (brand === "mastercard" && !form.email.trim()) return "Adresse email requise pour une Mastercard";
    if (brand === "mastercard" && !idImageBack) return "Photo verso de la pièce d'identité requise pour une Mastercard";
    if (!form.phone.trim()) return "Téléphone requis";
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.postalCode.trim()) return "Adresse complète requise";
    if (!/^[A-Z]{3}$/.test(form.country)) return "Code pays sur 3 lettres (ex: BFA, CIV, SEN)";
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) { setError(v); return; }
    if (!afford?.can_afford) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await cardApi.buy({ amount, currency: "USD", brand, ...form, idImage: idImage ?? undefined, idImageBack: idImageBack ?? undefined });
      if ((r as any)?.ok === false) throw new Error((r as any).error || "Émission échouée");
      setSuccess(true);
      onIssued?.();
      setTimeout(() => { setSuccess(false); onClose(); }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Émission de la carte impossible");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92vh] max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-6 shadow-card-premium sm:bottom-1/2 sm:translate-y-1/2 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight">Nouvelle carte</h2>
                <p className="mt-1 text-sm text-muted-foreground">Carte virtuelle NFC · USD</p>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Brand */}
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Réseau</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["visa", "mastercard"] as Brand[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setBrand(b);
                      setField("idType", b === "mastercard" ? "NIN" : "national_id");
                    }}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                      brand === b ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> {b}
                    </span>
                    {brand === b && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Initial funding */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Approvisionnement initial <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Minimum 3 USD</span>
                </label>
              </div>
              <div className="mt-2 flex items-baseline gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                <input
                  type="number"
                  inputMode="decimal"
                  min={MIN_INITIAL_FUND_USD}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full bg-transparent font-[Space_Grotesk] text-3xl font-bold tabular-nums outline-none"
                />
                <span className="text-sm font-semibold text-muted-foreground">USD</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {FUND_PRESETS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      amount === q ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface-2 hover:bg-muted"
                    }`}
                  >
                    ${q}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                La carte est créée avec une recharge initiale obligatoire d'au moins <b>3 USD</b>. Son numéro complet et son CVV sont alors disponibles.
              </p>
            </div>

            {/* Personal info (required by NFC API) */}
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Informations personnelles</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Ces informations sont transmises à l'émetteur pour générer la carte NFC.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Input ph="Prénom" v={form.firstName} on={(v) => setField("firstName", v)} />
                <Input ph="Nom" v={form.lastName} on={(v) => setField("lastName", v)} />
                {brand === "mastercard" && <Input ph="Autres noms (facultatif)" v={form.otherNames} on={(v) => setField("otherNames", v)} colSpan />}
                {brand === "mastercard" && <Input ph="Adresse email" type="email" v={form.email} on={(v) => setField("email", v)} colSpan />}
                <Input ph="Date de naissance (AAAA-MM-JJ)" type="date" v={form.dob} on={(v) => setField("dob", v)} colSpan />
                <select
                  value={form.idType}
                  onChange={(e) => setField("idType", e.target.value as Form["idType"])}
                  className="col-span-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none"
                >
                  {brand === "mastercard" ? (
                    <>
                      <option value="NIN">NIN</option>
                      <option value="BVN">BVN</option>
                      <option value="passport">Passeport international</option>
                    </>
                  ) : (
                    <>
                      <option value="national_id">Pièce d'identité nationale</option>
                      <option value="passport">Passeport</option>
                      <option value="drivers_license">Permis de conduire</option>
                    </>
                  )}
                </select>
                <Input ph="Numéro de pièce" v={form.idNumber} on={(v) => setField("idNumber", v)} colSpan />
                <div className="col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <p className="text-xs font-semibold">Photo de la pièce d'identité <span className="text-destructive">*</span></p>
                   <p className="mt-0.5 text-[11px] text-muted-foreground">Recto net en JPG ou PNG. Compression automatique sous 1 Mo.</p>
                  <div className="mt-2 flex items-center gap-3">
                    {idPreview ? (
                      <img src={idPreview} alt="Aperçu de la pièce d'identité" className="h-14 w-20 rounded-lg object-cover ring-1 ring-border" />
                    ) : (
                      <div className="grid h-14 w-20 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                       {idImage ? "Remplacer" : "Choisir"}
                    </button>
                    {idImage && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success"><Check className="h-3.5 w-3.5" /> Envoyée</span>}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => pickIdImage(e.target.files?.[0])}
                  />
                </div>
                {brand === "mastercard" && (
                  <div className="col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                    <p className="text-xs font-semibold">Verso de la pièce d'identité <span className="text-destructive">*</span></p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">JPG ou PNG, compression automatique sous 1 Mo.</p>
                    <div className="mt-2 flex items-center gap-3">
                      {idBackPreview ? (
                        <img src={idBackPreview} alt="Aperçu du verso de la pièce" className="h-14 w-20 rounded-lg object-cover ring-1 ring-border" />
                      ) : (
                        <div className="grid h-14 w-20 place-items-center rounded-lg border border-dashed border-border text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                      )}
                      <button type="button" onClick={() => backFileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                         {idImageBack ? "Remplacer" : "Choisir"}
                      </button>
                      {idImageBack && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success"><Check className="h-3.5 w-3.5" /> Envoyée</span>}
                    </div>
                    <input ref={backFileRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => pickIdImage(e.target.files?.[0], "back")} />
                  </div>
                )}
                <Input ph="Téléphone (format local)" v={form.phone} on={(v) => setField("phone", v)} colSpan />
                <Input ph="Adresse (ligne 1)" v={form.line1} on={(v) => setField("line1", v)} colSpan />
                <Input ph="Ville" v={form.city} on={(v) => setField("city", v)} />
                <Input ph="Région / État" v={form.state} on={(v) => setField("state", v)} />
                <Input ph="Code postal" v={form.postalCode} on={(v) => setField("postalCode", v)} />
                <Input ph="Pays (3 lettres, ex: BFA)" v={form.country} on={(v) => setField("country", v.toUpperCase())} />
              </div>
              <div className="mt-3 rounded-xl border border-border bg-surface-2/60 p-3 text-[11px] text-muted-foreground">
                <p className="font-medium text-foreground">Adresse de facturation par défaut</p>
                <p className="mt-1">3401 N. Miami Ave, Ste 230 · Miami, FL 33127 · USA</p>
                <p className="mt-1">Déjà pré-remplie — modifiez-la si nécessaire.</p>
              </div>
            </div>

            {/* Funds check */}
            <div
              className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${
                checking
                  ? "border-border bg-surface-2"
                  : afford?.can_afford
                    ? "border-success/40 bg-success/5"
                    : "border-warning/40 bg-warning/5"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  checking
                    ? "bg-muted text-muted-foreground"
                    : afford?.can_afford
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : afford?.can_afford ? <Wallet className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              <div className="text-sm">
                {checking && <p className="font-medium">Vérification du solde…</p>}
                {!checking && afford && (
                  <>
                    <p className="font-medium">
                      {afford.can_afford ? "Fonds suffisants" : "Solde insuffisant"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Requis&nbsp;: <span className="tabular-nums">{afford.required.toLocaleString("fr-FR")} XOF</span>{" "}
                      · Disponible&nbsp;: <span className="tabular-nums">{afford.available.toLocaleString("fr-FR")} XOF</span>
                    </p>
                  </>
                )}
                {!checking && !afford && !error && <p className="text-xs text-muted-foreground">Saisissez un montant pour vérifier.</p>}
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={submitting || checking || uploading || !afford?.can_afford || amount < MIN_INITIAL_FUND_USD}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : success ? (
                <>Carte émise <Check className="h-4 w-4" /></>
              ) : afford && !afford.can_afford ? (
                <>Recharger d'abord <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Émettre la carte <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
               Frais d'émission : <b>4 500 XOF</b> — recharge initiale minimum : <b>3 USD</b>.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Input({ ph, v, on, type = "text", colSpan }: { ph: string; v: string; on: (v: string) => void; type?: string; colSpan?: boolean }) {
  return (
    <input
      type={type}
      placeholder={ph}
      value={v}
      onChange={(e) => on(e.target.value)}
      className={`rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground ${colSpan ? "col-span-2" : ""}`}
    />
  );
}