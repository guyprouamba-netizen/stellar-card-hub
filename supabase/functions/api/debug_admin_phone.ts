import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function testAdminPhone() {
  console.log("Checking platform_config for admin_notification_phone...");
  const { data, error } = await admin
    .from("platform_config")
    .select("*")
    .eq("key", "admin_notification_phone")
    .maybeSingle();

  if (error) {
    console.error("Error fetching config:", error);
  } else {
    console.log("admin_notification_phone current value:", data);
  }
}

testAdminPhone();
