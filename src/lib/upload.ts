import { supabase } from "@/integrations/supabase/client";

// Uploads a file to the private business-media bucket under <user-id>/<folder>/<filename>
// and returns a long-lived signed URL (1 year) suitable for use in <img>/<video> src.
export async function uploadBusinessMedia(file: File, folder: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const name = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("business-media").upload(name, file, {
    contentType: file.type, upsert: false,
  });
  if (upErr) throw upErr;
  const { data: signed, error: sErr } = await supabase.storage.from("business-media")
    .createSignedUrl(name, 60 * 60 * 24 * 365);
  if (sErr) throw sErr;
  return signed.signedUrl;
}

// Refresh a signed URL if it has expired (rare, given 1y TTL)
export async function refreshSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("business-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) throw error;
  return data.signedUrl;
}

// Uploads an identity document image to the private `kyc` bucket and returns a
// long-lived signed URL. The card issuer fetches this URL server-side when
// creating the card (`id_image`).
export async function uploadIdImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("Le fichier doit être une image JPG ou PNG");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image source trop lourde (max 12 Mo)");
  const prepared = await prepareIdentityImage(file);
  const ext = prepared.type === "image/png" ? "png" : "jpg";
  const name = `${user.id}/id-cards/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("kyc").upload(name, prepared, {
    contentType: prepared.type, upsert: false,
  });
  if (upErr) throw upErr;
  const { data: signed, error: sErr } = await supabase.storage.from("kyc")
    .createSignedUrl(name, 60 * 60 * 24 * 365);
  if (sErr) throw sErr;
  return signed.signedUrl;
}

async function prepareIdentityImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  if (Math.max(width, height) > 1800) {
    const ratio = 1800 / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer cette image");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 900 * 1024) return blob;
  }
  throw new Error("L’image reste trop lourde après compression. Recadrez-la puis réessayez.");
}