import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";

type Variant = "primary" | "teal" | "sunset";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-card",
  teal: "bg-gradient-card-2",
  sunset: "bg-gradient-card-3",
};

export function VirtualCard({
  variant = "primary",
  holder = "ALEX MARTIN",
  number,
  expiry = "09/29",
  balance,
  brand = "Visa",
  cvv,
  numberUrl,
  cvvUrl,
  onFlip,
  floating = false,
  className = "",
}: {
  variant?: Variant;
  holder?: string;
  number?: string;
  expiry?: string;
  balance?: string;
  brand?: string;
  cvv?: string;
  numberUrl?: string;
  cvvUrl?: string;
  onFlip?: (flipped: boolean) => void;
  floating?: boolean;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  function toggle() {
    const next = !flipped;
    setFlipped(next);
    onFlip?.(next);
  }
  return (
    <div
      className={`relative aspect-[1.586/1] w-full cursor-pointer select-none ${className}`}
      style={{ perspective: 1200 }}
      onClick={toggle}
      role="button"
      aria-label={flipped ? "Voir le recto" : "Voir le CVV"}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0, y: floating && !flipped ? 0 : 0 }}
        initial={floating ? { opacity: 0, y: 30 } : { opacity: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* RECTO */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-[22px] p-4 text-white shadow-card-premium sm:rounded-3xl sm:p-6 ${variants[variant]}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl sm:h-40 sm:w-40" />
          <div className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-black/20 blur-2xl sm:h-48 sm:w-48" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <img src={logo} alt="" className="h-6 w-6 rounded-md ring-1 ring-white/40 sm:h-7 sm:w-7" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.18em]">FASO-INVEST <span className="opacity-80">PAY</span></p>
                </div>
                <p className="mt-2 text-[9px] uppercase tracking-[0.16em] opacity-70 sm:mt-3 sm:text-[10px] sm:tracking-widest">Solde</p>
                <p className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{balance ?? "$ 0.00"}</p>
              </div>
              <Wifi className="h-5 w-5 rotate-90 opacity-80 sm:h-6 sm:w-6" />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="h-7 w-10 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 shadow-inner sm:h-8 sm:w-11" />
              </div>
              {numberUrl ? (
                <div className="w-full" onClick={(e) => e.stopPropagation()}>
                  <iframe
                    src={numberUrl}
                    title="Numéro de carte sécurisé"
                    width="100%"
                    height="32"
                    frameBorder="0"
                    scrolling="no"
                    style={{ border: "none", overflow: "hidden", colorScheme: "normal" }}
                  />
                </div>
              ) : (
                <p
                  className="font-mono text-[15px] font-semibold tracking-[0.1em] leading-tight sm:text-2xl sm:tracking-[0.18em] select-all cursor-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {number ? formatPan(number) : "•••• •••• •••• ••••"}
                </p>
              )}
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.16em] opacity-60 sm:text-[10px] sm:tracking-widest">Titulaire</p>
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] sm:text-sm sm:tracking-wider select-all" onClick={(e) => e.stopPropagation()}>{holder}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.16em] opacity-60 sm:text-[10px] sm:tracking-widest">Exp</p>
                  <p className="text-xs font-medium tabular-nums sm:text-sm select-all" onClick={(e) => e.stopPropagation()}>{formatExpiry(expiry)}</p>
                </div>
                <p className="italic text-base font-semibold sm:text-lg">{brand}</p>
              </div>
            </div>
          </div>
        </div>

        {/* VERSO */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-[22px] text-white shadow-card-premium sm:rounded-3xl ${variants[variant]}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="absolute inset-x-0 top-5 h-9 bg-black/70 sm:top-6 sm:h-10" />
          <div className="absolute inset-x-4 top-20 flex items-center gap-2 sm:inset-x-6 sm:top-24 sm:gap-3">
            <div className="h-9 flex-1 rounded bg-white/85 sm:h-10" />
            <div
              className="grid h-9 min-w-[72px] place-items-center rounded bg-white px-2.5 text-right font-mono text-base font-bold tracking-[0.16em] text-black sm:h-10 sm:min-w-[80px] sm:px-3 sm:text-lg sm:tracking-widest select-all cursor-text"
              onClick={(e) => e.stopPropagation()}
            >
              {cvvUrl ? (
                <iframe
                  src={cvvUrl}
                  title="CVV sécurisé"
                  width="100%"
                  height="30"
                  frameBorder="0"
                  scrolling="no"
                  style={{ border: "none", overflow: "hidden" }}
                />
              ) : (
                cvv || "•••"
              )}
            </div>
          </div>
          <div className="absolute inset-x-4 top-32 sm:inset-x-6 sm:top-40">
            <p className="text-[9px] uppercase tracking-[0.16em] opacity-70 sm:text-[10px] sm:tracking-widest">CVV</p>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between sm:bottom-5 sm:left-6 sm:right-6">
            <span />
            <p className="italic text-base font-semibold sm:text-lg">{brand}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatPan(pan: string) {
  const s = pan.replace(/\s+/g, "");
  return s.match(/.{1,4}/g)?.join(" ") || pan;
}

function formatExpiry(expiry: string) {
  const match = expiry.match(/^(\d{2})\/(\d{4})$/);
  if (!match) return expiry;
  return `${match[1]}/${match[2].slice(-2)}`;
}