"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Notif = { id: string; type: string; text: string; link: string | null; read: boolean; createdAt: string };
const ICON: Record<string, string> = { assigned: "📌", mention: "💬", comment: "🗨️", due: "⏰", finance: "💰" };

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function AvisosPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loaded, setLoaded] = useState(false);

  function load() {
    fetch("/api/notifications").then((r) => r.json()).then((d) => setItems(d.notifications || [])).finally(() => setLoaded(true));
  }
  useEffect(load, []);

  async function markAll() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
  }
  async function open(n: Notif) {
    if (!n.read) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Geral</div>
          <div className="fx-title">Avisos</div>
        </div>
        {unread > 0 && (
          <button className="fx-btn" style={{ marginLeft: "auto" }} onClick={markAll}>Marcar todas como lidas</button>
        )}
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px 48px", maxWidth: 720 }}>
        {!loaded && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {loaded && items.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--txt-faint)", marginTop: 50 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🔔</div>
            <p>Sem novidades por aqui.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className="fx-hoverable"
              style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left", width: "100%", background: n.read ? "var(--surface)" : "rgba(146,80,172,.08)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", cursor: "pointer" }}
            >
              <span style={{ fontSize: 18 }}>{ICON[n.type] || "🔔"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, color: "var(--txt)" }}>{n.text}</span>
                <span style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{ago(n.createdAt)}</span>
              </span>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--coral-deep, #d85a30)", flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
