import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { id?: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Résume l'activité de la plateforme sur la période",
  "D'où viennent mes utilisateurs et quels appareils utilisent-ils ?",
  "Quels sont les points de friction financiers à corriger ?",
  "Donne-moi 3 priorités stratégiques pour la semaine",
];

export function DashboardAiAssistant({ days = 30 }: { days?: number }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("dashboard-ai", { body: { action: "history" } });
        if (data?.conversation) setConversationId(data.conversation.id);
        if (Array.isArray(data?.messages)) setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      } catch { /* historique optionnel */ }
    })();
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("dashboard-ai", {
        body: { action: "chat", message: question, days, conversation_id: conversationId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setConversationId(data.conversation_id);
      setMessages((m) => [...m, { id: data.message?.id, role: "assistant", content: data.message?.content || "" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assistant indisponible";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="flex h-[calc(100vh-9rem)] flex-col rounded-2xl border border-border bg-card/40">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
        <div>
          <h3 className="text-sm font-semibold">Assistant analytique</h3>
          <p className="text-[11px] text-muted-foreground">Interroge tes données ({days} derniers jours) en langage naturel</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!messages.length && (
          <div className="mx-auto max-w-md py-10 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Pose une question sur le trafic, les revenus, la rétention ou les cartes.</p>
            <div className="mt-4 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-border px-3 py-2 text-left text-xs hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Bot className="h-3.5 w-3.5" /></span>}
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-2 border border-border"}`}>
              {m.content}
            </div>
            {m.role === "user" && <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted"><User className="h-3.5 w-3.5" /></span>}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse des données en cours…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          placeholder="Ex. Quel est le taux de conversion des dépôts cette semaine ?"
          className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}
