import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { startSession, trackPageview, trackPageDuration } from "@/lib/analytics/tracker";

/**
 * Suivi de trafic interne (aucun outil tiers) : session, pages vues, temps par page.
 * Ne stocke aucune donnée sensible et n'interrompt jamais l'interface en cas d'erreur.
 */
export function AnalyticsTracker() {
  const location = useLocation();
  const current = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    void startSession();
  }, []);

  useEffect(() => {
    const path = location.pathname;
    const previous = current.current;
    if (previous && previous.path !== path) {
      void trackPageDuration(previous.path, Date.now() - previous.at);
    }
    current.current = { path, at: Date.now() };
    void startSession();
    void trackPageview(path);
  }, [location.pathname]);

  useEffect(() => {
    const flush = () => {
      const previous = current.current;
      if (previous) void trackPageDuration(previous.path, Date.now() - previous.at);
    };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}