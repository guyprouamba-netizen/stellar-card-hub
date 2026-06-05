import { Link } from "@tanstack/react-router";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const publicLinks = [
  { to: "/", label: "Accueil" },
  { to: "/dashboard", label: "Tableau de bord" },
];
const adminExtraLinks = [
  { to: "/admin", label: "Console Admin" },
];

export function SiteNav() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setSignedIn(!!session);
      if (!session) { setIsAdmin(false); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      if (!active) return;
      setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const links = [...publicLinks, ...adminExtraLinks];
  void isAdmin;
  async function logout() { await supabase.auth.signOut(); }

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src={logo} alt="FASO-INVEST PAY" width={36} height={36} className="h-9 w-9 rounded-xl" />
          <span className="text-lg">FASO-INVEST <span className="text-primary">PAY</span></span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {publicLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/admin"
            className="rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/25"
            activeProps={{ className: "bg-primary/25" }}
          >
            Console Admin
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Changer le thème"
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 transition-colors hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {signedIn ? (
            <button
              onClick={logout}
              className="hidden rounded-full border border-border/60 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted md:inline-flex"
            >
              Déconnexion
            </button>
          ) : (
            <Link
              to="/auth"
              className="hidden rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105 md:inline-flex"
            >
              Commencer
            </Link>
          )}
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
            {signedIn ? (
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="mt-2 rounded-full border border-border/60 px-5 py-2 text-center text-sm font-semibold text-foreground"
              >
                Déconnexion
              </button>
            ) : (
              <Link to="/auth" className="mt-2 rounded-full bg-gradient-primary px-5 py-2 text-center text-sm font-semibold text-primary-foreground">
                Commencer
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}