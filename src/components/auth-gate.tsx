import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { PinLock } from "@/components/pin-lock";
import { isPinEnabledOnDevice, isSessionLocked, markActiveNow, setSessionLocked, shouldLockAfterBackground } from "@/lib/pin";

/**
 * Wrap authenticated pages so we ONLY render children once a Supabase session exists.
 * Otherwise redirect to /auth. Prevents "blank page" caused by racing API calls
 * that fire before the JWT is hydrated (all return 401 → sub-components throw).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sub = supabase.auth.onAuthStateChange((_e, sess) => {
      if (cancelled) return;
      if (sess) { setReady(true); setUserId(sess.user.id); }
      else if (!navigator.onLine) setReady(true);
      else { setReady(false); navigate("/auth", { replace: true }); }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) { setReady(true); setUserId(data.session.user.id); }
      else if (!navigator.onLine) setReady(true);
      else navigate("/auth", { replace: true });
    });
    return () => { cancelled = true; sub.data.subscription.unsubscribe(); };
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    if (!isPinEnabledOnDevice(userId)) { setLocked(false); return; }
    if (isSessionLocked() || shouldLockAfterBackground()) { setSessionLocked(true); setLocked(true); }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") markActiveNow();
      else if (shouldLockAfterBackground()) { setSessionLocked(true); setLocked(true); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId]);

  if (ready && locked) {
    return <PinLock mode="unlock" onSuccess={() => { setSessionLocked(false); markActiveNow(); setLocked(false); }} />;
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre session…</div>
      </div>
    );
  }
  return <>{children}</>;
}