import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idType: z.enum(["PASSPORT","NIN","DRIVERS_LICENSE","VOTERS_CARD","ID_CARD"]),
  idNumber: z.string().min(1).max(64),
  idImagePath: z.string().min(1), // path in 'kyc' bucket
  selfiePath: z.string().min(1),
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  country: z.string().min(2).max(3),   // ISO-2 ou ISO-3
  zipCode: z.string().min(2).max(20),
  houseNumber: z.string().min(1).max(20),
});

export const submitFullKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Build signed URLs for Strowallet (7 days)
    const [idSig, selfieSig] = await Promise.all([
      supabaseAdmin.storage.from("kyc").createSignedUrl(data.idImagePath, 60 * 60 * 24 * 7),
      supabaseAdmin.storage.from("kyc").createSignedUrl(data.selfiePath, 60 * 60 * 24 * 7),
    ]);
    const idImage = idSig.data?.signedUrl ?? "";
    const selfie = selfieSig.data?.signedUrl ?? "";

    const { error: upsertErr } = await supabase.from("kyc_submissions").upsert({
      user_id: userId,
      status: "submitted",
      first_name: data.firstName, last_name: data.lastName,
      date_of_birth: data.dob, id_type: data.idType, id_number: data.idNumber,
      id_image_url: idImage, selfie_url: selfie,
      address: data.address, city: data.city, country: data.country,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (upsertErr) {
      return { ok: false as const, error: `Sauvegarde KYC échouée : ${upsertErr.message}` };
    }

    try {
      const { createStrowalletCustomer } = await import("./strowallet.server");
      const res = await createStrowalletCustomer({
        firstName: data.firstName, lastName: data.lastName, email, phone: data.phone,
        dob: data.dob, idType: data.idType, idNumber: data.idNumber,
        idImage, selfie,
        address: data.address, city: data.city, country: data.country,
      });
      const customerId = (res as any)?.response?.bitvcard_customer_id || (res as any)?.customerId || null;
      await supabaseAdmin.from("kyc_submissions").update({ provider_status: "sent", provider_response: res as any }).eq("user_id", userId);
      if (customerId) {
        await supabaseAdmin.from("profiles").update({ strowallet_customer_id: String(customerId) }).eq("id", userId);
      }
      return { ok: true as const, customerId };
    } catch (e) {
      const msg = (e as Error).message;
      await supabaseAdmin.from("kyc_submissions").update({ provider_status: "error", provider_response: { error: msg } as any }).eq("user_id", userId);
      return { ok: false as const, error: msg };
    }
  });

export const createKycUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["id","selfie"]), ext: z.string().regex(/^(jpg|jpeg|png|webp)$/i) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${context.userId}/${data.kind}-${Date.now()}.${data.ext.toLowerCase()}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("kyc").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Upload URL error");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });