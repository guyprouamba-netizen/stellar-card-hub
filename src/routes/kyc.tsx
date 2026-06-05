import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { submitFullKyc, createKycUploadUrl } from "@/lib/kyc.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/kyc")({
  head: () => ({ meta: [{ title: "Validation KYC — FASO-INVEST PAY" }] }),
  component: KycPage,
});

const ID_TYPES = [
  { v: "NIN", l: "CNIB / Carte d'identité nationale" },
  { v: "PASSPORT", l: "Passeport" },
  { v: "DRIVERS_LICENSE", l: "Permis de conduire" },
  { v: "VOTERS_CARD", l: "Carte d'électeur" },
  { v: "ID_CARD", l: "Autre pièce d'identité" },
];

function KycPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setReady(true);
    });
  }, [navigate]);

  const [f, setF] = useState({
    firstName: "", lastName: "", phone: "", dob: "",
    idType: "NIN", idNumber: "",
    address: "", city: "Ouagadougou", state: "Centre",
    country: "BF", zipCode: "00226", houseNumber: "1",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const sign = useServerFn(createKycUploadUrl);
  const submit = useServerFn(submitFullKyc);

  async function uploadOne(file: File, kind: "id" | "selfie"): Promise<string> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const { path, token } = await sign({ data: { kind, ext } }) as any;
    const { error } = await supabase.storage.from("kyc").uploadToSignedUrl(path, token, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idFile || !selfieFile) { toast.error("Pièce d'identité et selfie obligatoires"); return; }
    setBusy(true);
    try {
      const [idPath, selfiePath] = await Promise.all([uploadOne(idFile, "id"), uploadOne(selfieFile, "selfie")]);
      const res: any = await submit({ data: { ...f, idType: f.idType as any, idImagePath: idPath, selfiePath } });
      if (res?.ok) { setDone(true); toast.success("KYC envoyé à Strowallet ✓"); }
      else toast.error(res?.error ?? "Échec");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (!ready) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (done) return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="max-w-md text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-6 font-[Space_Grotesk] text-3xl font-bold">KYC envoyé !</h1>
        <p className="mt-2 text-muted-foreground">Votre dossier a été transmis à Strowallet. Vous pourrez émettre des cartes dès validation (généralement sous 24-48h).</p>
        <Link to="/dashboard" className="mt-6 inline-flex rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">Retour au tableau de bord</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <BackButton to="/dashboard" className="mb-6" />
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h1 className="font-[Space_Grotesk] text-2xl font-bold">Validation KYC Strowallet</h1>
              <p className="text-sm text-muted-foreground">Vos informations sont transmises directement à Strowallet pour validation.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom"><input required value={f.firstName} onChange={(e) => setF({...f, firstName: e.target.value})} className={inputCls} /></Field>
              <Field label="Nom"><input required value={f.lastName} onChange={(e) => setF({...f, lastName: e.target.value})} className={inputCls} /></Field>
              <Field label="Téléphone (international)"><input required value={f.phone} onChange={(e) => setF({...f, phone: e.target.value})} placeholder="+226..." className={inputCls} /></Field>
              <Field label="Date de naissance"><input required type="date" value={f.dob} onChange={(e) => setF({...f, dob: e.target.value})} className={inputCls} /></Field>
              <Field label="Type de pièce">
                <select value={f.idType} onChange={(e) => setF({...f, idType: e.target.value})} className={inputCls}>
                  {ID_TYPES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label="Numéro de pièce"><input required value={f.idNumber} onChange={(e) => setF({...f, idNumber: e.target.value})} className={inputCls} /></Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FileField label="Photo de la pièce" file={idFile} setFile={setIdFile} />
              <FileField label="Selfie avec pièce" file={selfieFile} setFile={setSelfieFile} />
            </div>

            <div className="grid gap-4">
              <Field label="Adresse"><input required value={f.address} onChange={(e) => setF({...f, address: e.target.value})} className={inputCls} placeholder="Quartier, rue, secteur" /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="N° de maison"><input required value={f.houseNumber} onChange={(e) => setF({...f, houseNumber: e.target.value})} className={inputCls} /></Field>
                <Field label="Ville"><input required value={f.city} onChange={(e) => setF({...f, city: e.target.value})} className={inputCls} /></Field>
                <Field label="Région / État"><input required value={f.state} onChange={(e) => setF({...f, state: e.target.value})} className={inputCls} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pays (ISO-2)"><input required value={f.country} maxLength={3} onChange={(e) => setF({...f, country: e.target.value.toUpperCase()})} className={inputCls} /></Field>
                <Field label="Code postal"><input required value={f.zipCode} onChange={(e) => setF({...f, zipCode: e.target.value})} className={inputCls} /></Field>
              </div>
            </div>

            <button type="submit" disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : "Envoyer mon dossier à Strowallet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}

function FileField({ label, file, setFile }: { label: string; file: File | null; setFile: (f: File | null) => void }) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm ${file ? "border-success bg-success/5 text-success" : "border-border bg-surface-2"}`}>
        <Upload className="h-4 w-4" />
        <span className="truncate">{file ? file.name : "Choisir un fichier (JPG/PNG)"}</span>
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
