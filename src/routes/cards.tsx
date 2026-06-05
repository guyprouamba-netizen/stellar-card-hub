import { createFileRoute } from "@tanstack/react-router";
import { Plus, Snowflake, Trash2, Settings } from "lucide-react";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { VirtualCard } from "@/components/virtual-card";
import { IssueCardSheet } from "@/components/issue-card-sheet";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Mes cartes — Volty" },
      { name: "description", content: "Gérez l'ensemble de vos cartes virtuelles." },
    ],
  }),
  component: CardsPage,
});

const list = [
  { variant: "primary" as const, label: "Carte principale", number: "4242  4242  4242  4242", balance: "€4 820,12", brand: "Visa", status: "Active" },
  { variant: "teal" as const, label: "Carte USD", number: "5320  ****  ****  9821", balance: "$1 240,00", brand: "Mastercard", status: "Active" },
  { variant: "sunset" as const, label: "Voyage", number: "6011  ****  ****  4421", balance: "£610,40", brand: "Visa", status: "Gelée" },
];

function CardsPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="container mx-auto px-4 py-4 sm:px-6">
        <BackButton to="/dashboard" className="mb-2" />
      </div>
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight sm:text-4xl">Mes cartes</h1>
            <p className="mt-1 text-sm text-muted-foreground">{list.length} cartes virtuelles actives</p>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-105 transition-transform">
            <Plus className="h-4 w-4" /> Nouvelle carte
          </button>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <VirtualCard {...c} />
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.label}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c.status === "Active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {c.status}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 py-2 text-xs font-medium hover:bg-muted">
                    <Snowflake className="h-3.5 w-3.5" /> Geler
                  </button>
                  <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 py-2 text-xs font-medium hover:bg-muted">
                    <Settings className="h-3.5 w-3.5" /> Réglages
                  </button>
                  <button className="inline-flex items-center justify-center rounded-full border border-border bg-surface-2 px-3 py-2 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <IssueCardSheet open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}