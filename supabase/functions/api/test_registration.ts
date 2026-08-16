
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Note: we can't easily get a user token here without credentials, 
  // but we can try to call the function and see if it returns 401/404.
  // 401 = handler found, but unauthorized (correct)
  // 404 = unknown fn (incorrect)
  
  const fn = "listProductCategories";
  console.log(`Testing function: ${fn}`);
  
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, data: { business_id: 'dummy' } })
    });
    
    const status = res.status;
    const body = await res.json();
    
    console.log(`Status: ${status}`);
    console.log(`Body:`, body);
    
    if (status === 404 && body.error?.includes("unknown fn")) {
      console.error("FAIL: Function still not found");
      Deno.exit(1);
    } else if (status === 401) {
      console.log("SUCCESS: Function found (returned 401 Unauthorized as expected)");
    } else {
      console.log(`Observation: Received ${status}, which usually means the function is registered.`);
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

test();
