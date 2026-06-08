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
      className={`relative aspect-[1.586/1] w-full max-w-sm cursor-pointer select-none ${className}`}
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
          className={`absolute inset-0 overflow-hidden rounded-3xl p-6 text-white shadow-card-premium ${variants[variant]}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-black/20 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <img src={logo} alt="" className="h-7 w-7 rounded-md ring-1 ring-white/40" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]">FASO-INVEST <span className="opacity-80">PAY</span></p>
                </div>
                <p className="mt-3 text-[10px] uppercase tracking-widest opacity-70">Solde</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{balance ?? "$ 0.00"}</p>
              </div>
              <Wifi className="h-6 w-6 rotate-90 opacity-80" />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 shadow-inner" />
              </div>
              {/* Numéro à 16 chiffres sur le recto */}
              <p className="font-mono text-lg sm:text-xl font-semibold tracking-[0.18em]">
                {number ? formatPan(number) : "•••• •••• •••• ••••"}
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest opacity-60">Titulaire</p>
                  <p className="truncate text-sm font-semibold uppercase tracking-wider">{holder}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest opacity-60">Exp</p>
                  <p className="text-sm font-medium tabular-nums">{expiry}</p>
                </div>
                <p className="italic font-semibold text-lg">{brand}</p>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-widest opacity-60">Touchez pour voir le CVV</p>
            </div>
          </div>
        </div>

        {/* VERSO */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-3xl text-white shadow-card-premium ${variants[variant]}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="absolute inset-x-0 top-6 h-10 bg-black/70" />
          <div className="absolute inset-x-6 top-24 flex items-center gap-3">
            <div className="h-10 flex-1 rounded bg-white/85" />
            <div className="grid h-10 min-w-[80px] place-items-center rounded bg-white text-right font-mono text-lg font-bold tracking-widest text-black px-3">
              {cvv || "•••"}
            </div>
          </div>
          <div className="absolute inset-x-6 top-40">
            <p className="text-[10px] uppercase tracking-widest opacity-70">Code de sécurité (CVV)</p>
            <p className="mt-1 text-xs opacity-80">Les 3 chiffres au dos de votre carte.</p>
          </div>
          <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
            <p className="text-[10px] uppercase tracking-widest opacity-70">Touchez pour revenir</p>
            <p className="italic font-semibold text-lg">{brand}</p>
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