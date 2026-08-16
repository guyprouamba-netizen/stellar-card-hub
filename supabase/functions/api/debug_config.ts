import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function checkConfig() {
  console.log("Listing all platform_config entries related to notifications...");
  const { data, error } = await admin
    .from("platform_config")
    .select("*")
    .ilike("key", "%admin%");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Config entries:", data);
  }
}

checkConfig();
