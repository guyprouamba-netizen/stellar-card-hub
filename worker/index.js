// FASO-INVEST PAY — Chat PAY Worker (Baileys / WhatsApp Web)
// Connexion persistante WhatsApp, poll de la file d'envoi + report d'événements.

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import P from "pino";

const BRIDGE_URL = (process.env.BRIDGE_URL || "").replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const POLL_MS = Number(process.env.POLL_MS || 3000);
const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const VERSION = "2.0.0";

// ----- État global -----
let botConfig = null;
let botGroups = new Map(); // group_jid → override row
let actionsThisMin = 0;
let actionsThisHour = 0;
setInterval(() => { actionsThisMin = 0; }, 60_000);
setInterval(() => { actionsThisHour = 0; }, 3600_000);

// Detection de liens
const URL_RE = /\b((https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|net|org|io|co|xyz|me|app|link|ml|tk|ga|cf|store|shop|site|online|info|biz|africa|bf|ci|sn|ml)\b[^\s]*)/i;
const WA_LINK_RE = /(wa\.me\/|chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)/i;

function containsLink(text, whitelist) {
  if (!text) return false;
  if (WA_LINK_RE.test(text)) {
    // whitelist s'applique aux domaines classiques, jamais aux liens de groupes concurrents
    return true;
  }
  const m = text.match(URL_RE);
  if (!m) return false;
  const url = m[0].toLowerCase();
  return !(whitelist || []).some((w) => url.includes(String(w).toLowerCase()));
}

function isNight(cfg) {
  if (!cfg?.night_mode) return false;
  const h = new Date().getHours();
  const s = cfg.night_start_hour ?? 22, e = cfg.night_end_hour ?? 7;
  return s > e ? (h >= s || h < e) : (h >= s && h < e);
}

function gaussian(min, max) {
  // approx boîte-Muller centrée
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  const clamped = Math.max(-2, Math.min(2, n));
  const mid = (min + max) / 2, span = (max - min) / 4;
  return Math.round(mid + clamped * span);
}

async function humanDelay(cfg) {
  if (!cfg?.human_mode) return;
  const min = cfg.human_min_ms || 2000, max = cfg.human_max_ms || 8000;
  let d = gaussian(min, max);
  if (isNight(cfg)) d *= 2;
  await new Promise((r) => setTimeout(r, d));
}

async function rateGate(cfg) {
  const perMin = cfg?.rate_per_minute ?? 8;
  const perHour = cfg?.rate_per_hour ?? 120;
  while (actionsThisMin >= perMin || actionsThisHour >= perHour) {
    await new Promise((r) => setTimeout(r, 5000));
  }
  actionsThisMin++; actionsThisHour++;
}

if (!BRIDGE_URL || !SESSION_SECRET) {
  console.error("Missing BRIDGE_URL or SESSION_SECRET. See .env.example");
  process.exit(1);
}

async function bridge(path, method = "GET", body) {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-session-secret": SESSION_SECRET,
      "x-worker-version": VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`bridge ${path} ${res.status}: ${t}`);
  }
  return res.json().catch(() => ({}));
}

async function report(kind, payload) {
  try { await bridge("/event", "POST", { kind, payload }); }
  catch (e) { console.error("report failed", kind, e.message); }
}

async function logBot(kind, extra = {}) {
  try { await bridge("/log", "POST", { kind, ...extra }); }
  catch (e) { console.error("log failed", kind, e.message); }
}

async function refreshConfig() {
  try {
    const c = await bridge("/config", "GET");
    botConfig = c.config;
    botGroups = new Map((c.groups || []).map((g) => [g.group_jid, g]));
  } catch (e) { /* silencieux */ }
}
setInterval(refreshConfig, 60_000);

function normalizeJid(to) {
  if (!to) return null;
  if (to.includes("@")) return to;
  const digits = String(to).replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "warn" }),
    markOnlineOnConnect: false,
    browser: ["FASO-INVEST PAY", "Chrome", "1.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        await bridge("/status", "POST", { status: "qr", qr_data_url: dataUrl });
        console.log("QR généré, en attente du scan…");
      } catch (e) { console.error("qr encode", e.message); }
    }
    if (connection === "open") {
      const phone = sock.user?.id?.split(":")[0] || null;
      await bridge("/status", "POST", { status: "connected", phone_number: phone, qr_data_url: null });
      console.log("Connecté à WhatsApp:", phone);
      await refreshConfig();
    }
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      await bridge("/status", "POST", { status: loggedOut ? "logged_out" : "connecting" });
      if (!loggedOut) {
        console.log("Déconnecté, reconnexion dans 3s…", code);
        setTimeout(startSock, 3000);
      } else {
        console.log("Session déconnectée par WhatsApp. Régénère un QR depuis l'app.");
      }
    }
  });

  // Rejet d'appels
  sock.ev.on("call", async (calls) => {
    if (!botConfig?.reject_calls) return;
    for (const c of calls) {
      if (c.status !== "offer") continue;
      try { await sock.rejectCall(c.id, c.from); } catch (e) { console.error("rejectCall", e.message); }
      try {
        const r = await bridge("/call", "POST", { from_jid: c.from });
        await logBot("call_rejected", { user_jid: c.from, payload: { block: r.block } });
      } catch (e) { console.error(e); }
    }
  });

  // Bienvenue nouveaux membres
  sock.ev.on("group-participants.update", async (ev) => {
    if (ev.action !== "add") return;
    const g = botGroups.get(ev.id);
    const enabled = g?.welcome_enabled_override ?? botConfig?.welcome_enabled;
    if (!enabled) return;
    const tpl = g?.welcome_message || botConfig?.welcome_message || "Bienvenue 👋";
    for (const p of ev.participants) {
      const name = p.split("@")[0];
      const msg = tpl.replace(/\{\{name\}\}/g, name);
      await rateGate(botConfig); await humanDelay(botConfig);
      try {
        await sock.sendMessage(ev.id, { text: msg, mentions: [p] });
        await logBot("welcome", { group_jid: ev.id, user_jid: p });
      } catch (e) { console.error("welcome", e.message); }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const from = m.key.remoteJid;
      const isGroup = from?.endsWith("@g.us");
      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        m.message.videoMessage?.caption || "";
      const participant = m.key.participant || from;

      if (isGroup) {
        // Enregistre le groupe s'il n'est pas déjà connu
        if (!botGroups.has(from)) {
          try {
            const meta = await sock.groupMetadata(from);
            await bridge("/group", "POST", { group_jid: from, name: meta.subject, member_count: meta.participants.length });
            botGroups.set(from, { group_jid: from, name: meta.subject, active: true });
          } catch {}
        }

        // Commandes admin
        if (text.startsWith("!")) {
          const cmd = text.trim().split(/\s+/)[0];
          await handleGroupCommand(sock, from, m, cmd, text);
          await report("group_command", { from, cmd, text, participant });
          continue;
        }

        // Détection de liens
        const g = botGroups.get(from);
        const linkOn = g?.link_removal_override ?? botConfig?.link_removal;
        if (linkOn && containsLink(text, botConfig?.link_whitelist || [])) {
          try { await sock.sendMessage(from, { delete: m.key }); }
          catch (e) { console.error("delete link", e.message); }
          await logBot("link_removed", { group_jid: from, user_jid: participant, payload: { snippet: text.slice(0, 120) } });

          const warnOn = g?.warnings_enabled_override ?? botConfig?.warnings_enabled;
          if (warnOn) {
            try {
              const w = await bridge("/warn", "POST", { group_jid: from, user_jid: participant, reason: "link" });
              await rateGate(botConfig); await humanDelay(botConfig);
              const name = participant.split("@")[0];
              if (w.banned) {
                await sock.sendMessage(from, { text: `⛔ @${name} banni après ${w.count} avertissements (liens interdits).`, mentions: [participant] });
                try { await sock.groupParticipantsUpdate(from, [participant], "remove"); } catch (e) { console.error("kick", e.message); }
              } else {
                const variants = [
                  `⚠️ @${name} liens interdits (${w.count}/${w.threshold}).`,
                  `🚫 @${name} pas de liens ici — avertissement ${w.count}/${w.threshold}.`,
                  `⚠️ Merci @${name} d'éviter les liens (${w.count}/${w.threshold}).`,
                ];
                await sock.sendMessage(from, { text: variants[Math.floor(Math.random() * variants.length)], mentions: [participant] });
              }
            } catch (e) { console.error("warn flow", e.message); }
          }
          continue;
        }

        await report("incoming_message", { from, isGroup: true, text, participant, push_name: m.pushName || null });
      } else {
        // ----- DM privé : IA -----
        await report("incoming_message", { from, isGroup: false, text, push_name: m.pushName || null });
        if (!botConfig?.ai_enabled || !text) continue;
        try {
          try { await sock.sendPresenceUpdate("composing", from); } catch {}
          await humanDelay(botConfig);
          const r = await bridge("/ai_reply", "POST", { from_jid: from, from_name: m.pushName || null, text });
          if (r?.reply) {
            await rateGate(botConfig);
            await sock.sendMessage(from, { text: r.reply });
            await logBot("ai_reply", { user_jid: from, payload: { in: text.slice(0, 200), out: r.reply.slice(0, 200) } });
          }
        } catch (e) { console.error("ai reply", e.message); }
      }
    }
  });

  return sock;
}

async function handleGroupCommand(sock, from, msg, cmd, text) {
  try {
    if (cmd === "!scan") {
      await sock.sendMessage(from, { text: "🔍 Scan des messages récents en cours…" }, { quoted: msg });
    } else if (cmd === "!scanall") {
      const chats = Object.keys(sock.store?.chats?.all?.() || {});
      await sock.sendMessage(from, { text: `🔍 Scan global (${chats.length} chats) — traitement asynchrone.` }, { quoted: msg });
    } else if (cmd === "!diagdelete") {
      const meta = await sock.groupMetadata(from).catch(() => null);
      const me = sock.user?.id;
      const isAdmin = meta?.participants?.some((p) => (p.id === me) && (p.admin === "admin" || p.admin === "superadmin"));
      await sock.sendMessage(from, {
        text: `🩺 Diagnostic:\n• Bot admin: ${isAdmin ? "✅" : "❌"}\n• Participants: ${meta?.participants?.length || 0}\n• Méthode: sendMessage(delete)`,
      }, { quoted: msg });
    } else if (cmd === "!testdelete") {
      const sent = await sock.sendMessage(from, { text: "Ce message va s'auto-supprimer dans 3s." });
      setTimeout(async () => {
        try { await sock.sendMessage(from, { delete: sent.key }); } catch (e) { console.error(e); }
      }, 3000);
    }
  } catch (e) {
    await sock.sendMessage(from, { text: `❌ Erreur commande: ${e.message}` }, { quoted: msg });
  }
}

let sockRef = null;
startSock().then((s) => { sockRef = s; }).catch((e) => {
  console.error("startSock fatal", e);
  process.exit(1);
});

// Boucle de polling: récupère les messages à envoyer et les envoie.
async function pollOutbox() {
  try {
    if (!sockRef?.user) return;
    const { messages = [] } = await bridge("/outbox", "GET");
    for (const m of messages) {
      const jid = normalizeJid(m.to_jid);
      if (!jid) {
        await bridge(`/outbox/${m.id}/ack`, "POST", { ok: false, error: "invalid_jid" });
        continue;
      }
      try {
        await sockRef.sendMessage(jid, { text: m.body });
        await bridge(`/outbox/${m.id}/ack`, "POST", { ok: true });
      } catch (e) {
        await bridge(`/outbox/${m.id}/ack`, "POST", { ok: false, error: e.message });
      }
    }
  } catch (e) {
    // silencieux, on retentera
  }
}
setInterval(pollOutbox, POLL_MS);

// Heartbeat pour last_seen_at
setInterval(() => { bridge("/heartbeat", "POST").catch(() => {}); }, 30000);