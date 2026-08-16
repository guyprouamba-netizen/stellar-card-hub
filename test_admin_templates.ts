import { supabase } from "./src/integrations/supabase/client.ts";

async function testAdmin() {
    try {
        console.log("Checking session...");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log("No session found. Please sign in as admin.");
            return;
        }
        console.log("User:", session.user.email);

        console.log("Calling adminListShopTemplates via invoke...");
        const { data, error } = await supabase.functions.invoke("api", { 
            body: { fn: "adminListShopTemplates", data: {} } 
        });

        if (error) {
            console.error("Invoke error:", error);
            return;
        }

        console.log("Response data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testAdmin();
