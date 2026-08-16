import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function cleanConfig() {
  console.log("Cleaning redundant admin_notification_phone entries...");
  
  // Actually, we want to know WHICH ones exist.
  const { data, error } = await admin.from("platform_config").select("*").eq("key", "admin_notification_phone");
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Current entries:", data);
  
  // If there's only one, it's fine. But if it's "07933364", it's wrong (missing +226).
  // The user said "le numero disparait sans raison", which might be due to multiple UI sections 
  // fighting over the same key but different local states.
}

cleanConfig();
