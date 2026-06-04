import { motion } from "framer-motion";
import { Wifi } from "lucide-react";

type Variant = "primary" | "teal" | "sunset";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-card",
  teal: "bg-gradient-card-2",
  sunset: "bg-gradient-card-3",
};

export function VirtualCard({
  variant = "primary",
  holder = "ALEX MARTIN",
  number = "4242  4242  4242  4242",
  expiry = "09/29",
  balance,
  brand = "Visa",
  floating = false,
  className = "",
}: {
  variant?: Variant;
  holder?: string;
  number?: string;
  expiry?: string;
  balance?: string;
  brand?: string;
  floating?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={floating ? { opacity: 0, y: 30, rotate: -6 } : { opacity: 0 }}
      animate={floating ? { opacity: 1, y: 0, rotate: -6 } : { opacity: 1 }}
      whileHover={{ y: -6, rotate: floating ? -3 : 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`relative aspect-[1.586/1] w-full max-w-sm overflow-hidden rounded-3xl p-6 text-white shadow-card-premium ${variants[variant]} ${className}`}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-black/20 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-70">Solde</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{balance ?? "€2 480,50"}</p>
          </div>
          <Wifi className="h-6 w-6 rotate-90 opacity-80" />
        </div>

        <div>
          <div className="mb-1 flex items-center gap-3">
            <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 shadow-inner" />
          </div>
          <p className="font-mono text-lg tracking-[0.2em]">{number}</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-60">Titulaire</p>
              <p className="text-sm font-medium">{holder}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-60">Exp</p>
              <p className="text-sm font-medium tabular-nums">{expiry}</p>
            </div>
            <p className="italic font-semibold text-lg">{brand}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}