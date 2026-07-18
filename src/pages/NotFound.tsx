import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

// Redirections des URLs "legacy" (avant que tout ne soit préfixé par /business/:id/...).
// Empêche un 404 gênant quand l'utilisateur appuie sur "Retour".
const LEGACY_REDIRECTS: Array<[RegExp, string]> = [
  [/^\/accounting\/?$/i, "/business"],
  [/^\/contracts\/?$/i, "/business"],
  [/^\/marketing\/?$/i, "/business"],
  [/^\/bot\/?$/i, "/business"],
  [/^\/projects?\/?$/i, "/business"],
  [/^\/business\/undefined/i, "/business"],
  [/^\/business\/null/i, "/business"],
  [/^\/home\/?$/i, "/"],
  [/^\/index\/?$/i, "/"],
  [/^\/login\/?$/i, "/auth"],
  [/^\/signup\/?$/i, "/auth"],
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    for (const [pattern, target] of LEGACY_REDIRECTS) {
      if (pattern.test(path)) { navigate(target, { replace: true }); return; }
    }
  }, [location.pathname, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée. Utilisez les boutons ci-dessous.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            ← Revenir en arrière
          </button>
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Accueil
          </Link>
          <Link to="/dashboard" className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
            Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}