import { supabase } from "@/integrations/supabase/client";

async function call(body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-coach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token || ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Erreur coach");
  return j;
}

export const coachChat = (business_id: string, message: string, project_id?: string) =>
  call({ action: "chat", business_id, project_id, message });
export const coachDailyTip = (business_id: string, project_id?: string) =>
  call({ action: "daily_tip", business_id, project_id });
export const coachAlert = (business_id: string, project_id?: string) =>
  call({ action: "alert", business_id, project_id });
export const coachStrategy = (business_id: string, project_id?: string) =>
  call({ action: "strategy", business_id, project_id });
export const coachGeneratePlan = (business_id: string, project_id: string) =>
  call({ action: "generate_plan", business_id, project_id });

export async function listCoachMessages(business_id: string, project_id?: string) {
  const q = supabase.from("coach_messages").select("*").eq("business_id", business_id).order("created_at", { ascending: true }).limit(50);
  const { data, error } = project_id ? await q.eq("project_id", project_id) : await q;
  if (error) throw error;
  return data || [];
}