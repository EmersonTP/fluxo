"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Channel = { id: string; name: string; company?: { name: string } | null; _count?: { messages: number } };
type Msg = { id: string; text: string; createdAt: string; user?: { id: string; name: string; color: string } | null };

function dayLabel(d: Date) {
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ChatPanel({ meId }: { meId: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  const countRef = useRef(0);

  const loadChannels = useCallback(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => {
        setChannels(d.channels || []);
        if (!activeRef.current && d.channels?.length) {
          activeRef.current = d.channels[0].id;
          setActive(d.channels[0].id);
        }
      });
  }, []);

  const loadMessages = useCallback((channelId: string) => {
    fetch(`/api/channels/${channelId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        const msgs: Msg[] = d.messages || [];
        if (msgs.length !== countRef.current) {
          countRef.current = msgs.length;
          setMessages(msgs);
        }
      });
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!active) return;
    activeRef.current = active;
    countRef.current = -1;
    loadMessages(active);
    const t = setInterval(() => {
      if (activeRef.current) loadMessages(activeRef.current);
    }, 3500);
    return () => clearInterval(t);
  }, [active, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!text.trim() || !active) return;
    const body = text;
    setText("");
    const res = await fetch(`/api/channels/${active}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    });
    const d = await res.json();
    if (d.message) {
      setMessages((m) => [...m, d.message]);
      countRef.current += 1;
    }
  }

  async function createChannel() {
    if (!newChannel.trim()) return;
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newChannel }),
    });
    const d = await res.json();
    setNewChannel("");
    setCreating(false);
    if (d.channel) {
      await loadChannels();
      setActive(d.channel.id);
    }
  }

  const activeChannel = channels.find((c) => c.id === active);
  const activeName = activeChannel?.name;

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {activeChannel?.company ? activeChannel.company.name : "Geral"}
          </div>
          <div className="fx-title">{activeName ? `# ${activeName}` : "Chat"}</div>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Channels */}
        <div style={{ width: 220, borderRight: "1px solid var(--line)", overflowY: "auto", padding: "12px 8px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 8px" }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt-faint)" }}>Canais</span>
            <button onClick={() => setCreating((s) => !s)} title="Novo canal" style={{ background: "none", border: "none", color: "var(--roxo)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
              +
            </button>
          </div>
          {creating && (
            <div style={{ padding: "0 6px 8px" }}>
              <input
                className="fx-input"
                placeholder="nome-do-canal"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createChannel();
                  if (e.key === "Escape") setCreating(false);
                }}
                autoFocus
              />
            </div>
          )}
          {channels.map((c) => (
            <button key={c.id} onClick={() => setActive(c.id)} className={`fx-navitem ${active === c.id ? "active" : ""}`} style={{ fontSize: 13.5 }}>
              <span style={{ opacity: 0.55 }}>#</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{c.name}</span>
              {c.company && <span style={{ fontSize: 10, color: "var(--txt-faint)" }}>{c.company.name.split(" ")[0]}</span>}
            </button>
          ))}
          {channels.length === 0 && !creating && (
            <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: "8px" }}>Nenhum canal. Crie o primeiro no “+”.</p>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
            {!active && <p style={{ color: "var(--txt-soft)" }}>Selecione ou crie um canal.</p>}
            {active && messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--txt-faint)", marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <p style={{ fontSize: 14 }}>Seja o primeiro a falar em #{activeName}.</p>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const d = new Date(m.createdAt);
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== d.toDateString();
              const grouped =
                !newDay &&
                prev &&
                prev.user?.id === m.user?.id &&
                d.getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
              const mine = m.user?.id === meId;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div style={{ textAlign: "center", margin: "16px 0 12px" }}>
                      <span style={{ fontSize: 11, color: "var(--txt-faint)", background: "var(--col)", padding: "3px 12px", borderRadius: 999 }}>
                        {dayLabel(d)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: grouped ? 2 : 10, flexDirection: mine ? "row-reverse" : "row" }}>
                    <span style={{ width: 32, flexShrink: 0 }}>
                      {!grouped && (
                        <span className="fx-avatar" style={{ background: m.user?.color || "var(--roxo)" }}>
                          {(m.user?.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                      {!grouped && (
                        <div style={{ fontSize: 11, color: "var(--txt-faint)", marginBottom: 3 }}>
                          {m.user?.name || "Desconhecido"} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      <div
                        style={{
                          background: mine ? "var(--roxo)" : "var(--col)",
                          color: mine ? "#fff" : "var(--txt)",
                          borderRadius: 12,
                          padding: "9px 13px",
                          fontSize: 14,
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {active && (
            <div style={{ borderTop: "1px solid var(--line)", padding: "12px 20px", display: "flex", gap: 8 }}>
              <input
                className="fx-input"
                placeholder={`Mensagem em #${activeName}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              />
              <button className="fx-btn fx-btn-primary" onClick={send}>
                Enviar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
