import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = "Retour", className }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        if (to) {
          navigate({ to });
        } else {
          window.history.back();
        }
      }}
      className={`inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
