import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

type State = { error: Error | null };

/**
 * Catches render/effect errors in child components so a single crash inside
 * a business sub-tab doesn't leave the whole page blank.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary]", this.props.label, error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60vh] place-items-center px-6">
        <div className="max-w-md rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-3 font-[Space_Grotesk] text-xl font-bold">Un problème est survenu</h2>
          <p className="mt-2 break-words text-xs text-muted-foreground">{this.state.error.message}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Recharger
            </button>
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">
              <Home className="h-3.5 w-3.5" /> Tableau de bord
            </Link>
          </div>
        </div>
      </div>
    );
  }
}