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
const VERSION = "1.0.0";

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
      // Commandes bot en groupe
      if (isGroup && text.startsWith("!")) {
        const cmd = text.trim().split(/\s+/)[0];
        await handleGroupCommand(sock, from, m, cmd, text);
        await report("group_command", { from, cmd, text, participant: m.key.participant });
        continue;
      }
      await report("incoming_message", {
        from, isGroup, text,
        participant: m.key.participant || null,
        push_name: m.pushName || null,
        ts: m.messageTimestamp,
      });
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