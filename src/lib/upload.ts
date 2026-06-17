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