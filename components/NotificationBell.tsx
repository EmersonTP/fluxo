"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Notif = { id: string; type: string; text: string; link: string | null; read: boolean; createdAt: string };

function ago(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const TYPE_ICON: Record<string, string> = { assigned: "📌", mention: "💬", comment: "🗨️", due: "⏰" };

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const seenRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications || []);
        setUnread(d.unread || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
  }

  async function openItem(n: Notif) {
    if (!n.read) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
      setUnread((u) => Math.max(0, u - 1));
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  function toggle() {
    const next = !open;
    if (next && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ left: r.right + 8, bottom: Math.max(8, window.innerHeight - r.bottom) });
    }
    setOpen(next);
    if (next && unread > 0) {
      // give a beat so the badge clears visually after the panel is seen
      seenRef.current = true;
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
      <button ref={btnRef} onClick={toggle} className={`fx-rail-item ${open ? "active" : ""}`} title="Notificações" style={{ position: "relative" }}>
        <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        <span className="fx-rail-label">Avisos</span>
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 10,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--coral-deep, #d85a30)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 2000 }} />
          <div
            style={{
              position: "fixed",
              left: pos.left,
              bottom: pos.bottom,
              width: 320,
              maxHeight: 440,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.15))",
              zIndex: 2001,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
              <span className="serif" style={{ fontSize: 15, fontWeight: 500, color: "var(--txt)" }}>Notificações</span>
              {unread > 0 && (
                <button onClick={markAll} style={{ background: "none", border: "none", color: "var(--roxo)", cursor: "pointer", fontSize: 12 }}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div style={{ overflowY: "auto" }}>
              {items.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--txt-faint)", padding: "30px 16px" }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🔔</div>
                  <p style={{ fontSize: 13, margin: 0 }}>Sem novidades por aqui.</p>
                </div>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  style={{
                    display: "flex",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "11px 14px",
                    background: n.read ? "transparent" : "var(--roxo-soft, rgba(146,80,172,.08))",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICON[n.type] || "🔔"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, color: "var(--txt)", lineHeight: 1.4 }}>{n.text}</span>
                    <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{ago(new Date(n.createdAt))}</span>
                  </span>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--coral-deep, #d85a30)", flexShrink: 0, marginTop: 5 }} />}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
