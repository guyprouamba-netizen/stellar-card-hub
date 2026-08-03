import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/use-online";

const LAST_SYNC_KEY = "fasopay:last-sync-at";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    if (isOnline) {
      const now = Date.now();
      try { localStorage.setItem(LAST_SYNC_KEY, String(now)); } catch { /* ignore */ }
      setLastSync(now);
    } else {
      try {
        const raw = localStorage.getItem(LAST_SYNC_KEY);
        setLastSync(raw ? Number(raw) : Date.now());
      } catch {
        setLastSync(Date.now());
      }
    }
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="w-full border-b border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
    >
      Mode hors connexion — données synchronisées le{" "}
      {lastSync ? formatDate(lastSync) : "—"}. Les dépôts, retraits et
      transferts sont indisponibles.
    </div>
  );
}
