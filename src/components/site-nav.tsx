import { Link } from "@tanstack/react-router";
import { Moon, Sun, CreditCard, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTheme } from "./theme-provider";

const links = [
  { to: "/", label: "Accueil" },
  { to: "/dashboard", label: "Tableau de bord" },
  { to: "/cards", label: "Cartes" },
  { to: "/pricing", label: "Tarifs" },
];

export function SiteNav() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <CreditCard className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="text-lg">Volty</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Changer le thème"
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 transition-colors hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            to="/auth"
            className="hidden rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105 md:inline-flex"
          >
            Commencer
          </Link>
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/40 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium text-muted-foreground"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link to="/auth" className="mt-2 rounded-full bg-gradient-primary px-5 py-2 text-center text-sm font-semibold text-primary-foreground">
              Commencer
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}