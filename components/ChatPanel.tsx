"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Member = { id: string; name: string; color: string };
type Reaction = { id: string; emoji: string; userId: string };
type Att = { id: string; filename: string; mime: string; size: number };
type Msg = {
  id: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  parentId?: string | null;
  user?: Member | null;
  reactions: Reaction[];
  attachments: Att[];
  _count?: { replies: number };
};
type Channel = { id: string; name: string; company?: { name: string } | null; unread?: number };
type Dm = { id: string; other: Member; unread: number; lastAt: string | null };
type Active = { id: string; kind: "channel" | "dm"; name: string; sub: string } | null;

const EMOJIS = ["👍", "❤️", "😂", "🎉", "✅", "👀", "🔥", "🙏"];

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
  const [listsLoaded, setListsLoaded] = useState(false);
  const [dms, setDms] = useState<Dm[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState<Active>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [creating, setCreating] = useState(false);
  const [pickPeople, setPickPeople] = useState(false);
  const [editing, setEditing] = useState<{ id: string; val: string } | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [thread, setThread] = useState<Msg | null>(null);
  const [replies, setReplies] = useState<Msg[]>([]);
  const [threadText, setThreadText] = useState("");
  const [mention, setMention] = useState<{ q: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => {
      setChannels(d.channels || []);
      if (!activeRef.current && d.channels?.length) {
        const c = d.channels[0];
        activeRef.current = c.id;
        setActive({ id: c.id, kind: "channel", name: c.name, sub: c.company?.name || "Geral" });
      }
    }).finally(() => setListsLoaded(true));
    fetch("/api/dm").then((r) => r.json()).then((d) => setDms(d.dms || []));
  }, []);

  const loadMessages = useCallback((channelId: string) => {
    fetch(`/api/channels/${channelId}/messages`).then((r) => r.json()).then((d) => setMessages(d.messages || []));
  }, []);

  useEffect(() => {
    loadLists();
    fetch("/api/members").then((r) => r.json()).then((d) => setMembers(d.members || []));
  }, [loadLists]);

  useEffect(() => {
    if (!active) return;
    activeRef.current = active.id;
    loadMessages(active.id);
    const t = setInterval(() => {
      if (activeRef.current) {
        loadMessages(activeRef.current);
        loadLists();
      }
    }, 3500);
    return () => clearInterval(t);
  }, [active, loadMessages, loadLists]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function openChannel(c: Channel) {
    setThread(null);
    setActive({ id: c.id, kind: "channel", name: c.name, sub: c.company?.name || "Geral" });
    setChannels((cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
  }
  async function openDm(userId: string) {
    setThread(null);
    setPickPeople(false);
    const d = await fetch("/api/dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).then((r) => r.json());
    if (d.id) {
      setActive({ id: d.id, kind: "dm", name: d.other.name, sub: "Mensagem direta" });
      loadLists();
    }
  }

  async function send() {
    if (!text.trim() || !active) return;
    const body = text;
    setText("");
    setMention(null);
    const d = await fetch(`/api/channels/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    }).then((r) => r.json());
    if (d.message) setMessages((m) => [...m, d.message]);
  }

  async function sendReply() {
    if (!threadText.trim() || !active || !thread) return;
    const body = threadText;
    setThreadText("");
    const d = await fetch(`/api/channels/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, parentId: thread.id }),
    }).then((r) => r.json());
    if (d.message) {
      setReplies((r) => [...r, d.message]);
      setMessages((m) => m.map((x) => (x.id === thread.id ? { ...x, _count: { replies: (x._count?.replies || 0) + 1 } } : x)));
    }
  }

  async function uploadFile(file: File) {
    if (!active) return;
    const fd = new FormData();
    fd.append("file", file);
    const d = await fetch(`/api/channels/${active.id}/upload`, { method: "POST", body: fd }).then((r) => r.json());
    if (d.message) setMessages((m) => [...m, d.message]);
  }

  async function react(msg: Msg, emoji: string, inThread = false) {
    setReactFor(null);
    const d = await fetch(`/api/messages/${msg.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).then((r) => r.json());
    if (d.reactions) {
      const upd = (arr: Msg[]) => arr.map((x) => (x.id === msg.id ? { ...x, reactions: d.reactions } : x));
      inThread ? setReplies(upd) : setMessages(upd);
      if (thread?.id === msg.id) setThread({ ...thread, reactions: d.reactions });
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const { id, val } = editing;
    setEditing(null);
    if (!val.trim()) return;
    const d = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: val }),
    }).then((r) => r.json());
    if (d.message) setMessages((m) => m.map((x) => (x.id === id ? d.message : x)));
  }

  async function del(id: string, inThread = false) {
    if (!confirm("Apagar esta mensagem?")) return;
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    if (inThread) setReplies((r) => r.filter((x) => x.id !== id));
    else setMessages((m) => m.filter((x) => x.id !== id));
  }

  async function openThread(msg: Msg) {
    setThread(msg);
    const d = await fetch(`/api/messages/${msg.id}/replies`).then((r) => r.json());
    setReplies(d.replies || []);
  }

  // Autocomplete de @menção
  function onTextChange(v: string) {
    setText(v);
    const m = v.match(/@([\p{L}\d_.-]*)$/u);
    setMention(m ? { q: m[1].toLowerCase() } : null);
  }
  function pickMention(name: string) {
    const first = name.split(" ")[0];
    setText((t) => t.replace(/@([\p{L}\d_.-]*)$/u, `@${first} `));
    setMention(null);
  }
  const mentionList = mention ? members.filter((m) => m.name.toLowerCase().includes(mention.q)).slice(0, 6) : [];

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>{active?.sub || "Chat"}</div>
          <div className="fx-title">{active ? (active.kind === "dm" ? active.name : `# ${active.name}`) : "Chat"}</div>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar: canais + DMs */}
        <div style={{ width: 224, borderRight: "1px solid var(--line)", overflowY: "auto", padding: "12px 8px", flexShrink: 0 }}>
          <Header label="Canais" onAdd={() => setCreating((s) => !s)} />
          {creating && (
            <div style={{ padding: "0 6px 8px" }}>
              <input className="fx-input" placeholder="nome-do-canal" value={newChannel} autoFocus
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newChannel.trim()) {
                    const d = await fetch("/api/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newChannel }) }).then((r) => r.json());
                    setNewChannel(""); setCreating(false);
                    if (d.channel) { loadLists(); openChannel(d.channel); }
                  }
                  if (e.key === "Escape") setCreating(false);
                }} />
            </div>
          )}
          {channels.map((c) => (
            <button key={c.id} onClick={() => openChannel(c)} className={`fx-navitem ${active?.id === c.id ? "active" : ""}`} style={{ fontSize: 13.5 }}>
              <span style={{ opacity: 0.55 }}>#</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left", fontWeight: c.unread ? 700 : 400 }}>{c.name}</span>
              {!!c.unread && <span className="fx-unread">{c.unread}</span>}
            </button>
          ))}
          {listsLoaded && channels.length === 0 && !creating && <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: 8 }}>Nenhum canal ainda.</p>}

          <div style={{ height: 14 }} />
          <Header label="Mensagens diretas" onAdd={() => setPickPeople((s) => !s)} />
          {pickPeople && (
            <div style={{ padding: "0 6px 8px", maxHeight: 220, overflowY: "auto" }}>
              {members.filter((m) => m.id !== meId).map((m) => (
                <button key={m.id} onClick={() => openDm(m.id)} className="fx-navitem" style={{ fontSize: 13 }}>
                  <span className="fx-avatar" style={{ background: m.color, width: 20, height: 20, fontSize: 9 }}>{m.name.charAt(0).toUpperCase()}</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{m.name}</span>
                </button>
              ))}
            </div>
          )}
          {dms.map((d) => (
            <button key={d.id} onClick={() => { setThread(null); setActive({ id: d.id, kind: "dm", name: d.other.name, sub: "Mensagem direta" }); setDms((xs) => xs.map((x) => x.id === d.id ? { ...x, unread: 0 } : x)); }}
              className={`fx-navitem ${active?.id === d.id ? "active" : ""}`} style={{ fontSize: 13.5 }}>
              <span className="fx-avatar" style={{ background: d.other.color, width: 20, height: 20, fontSize: 9 }}>{d.other.name.charAt(0).toUpperCase()}</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left", fontWeight: d.unread ? 700 : 400 }}>{d.other.name}</span>
              {!!d.unread && <span className="fx-unread">{d.unread}</span>}
            </button>
          ))}
          {dms.length === 0 && !pickPeople && <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: 8 }}>Comece uma conversa no “+”.</p>}
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
            {!active && <p style={{ color: "var(--txt-soft)" }}>Selecione ou crie um canal.</p>}
            {active && messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--txt-faint)", marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <p style={{ fontSize: 14 }}>Seja o primeiro a falar {active.kind === "dm" ? `com ${active.name}` : `em #${active.name}`}.</p>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const d = new Date(m.createdAt);
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== d.toDateString();
              return (
                <div key={m.id}>
                  {newDay && (
                    <div style={{ textAlign: "center", margin: "16px 0 12px" }}>
                      <span style={{ fontSize: 11, color: "var(--txt-faint)", background: "var(--col)", padding: "3px 12px", borderRadius: 999 }}>{dayLabel(d)}</span>
                    </div>
                  )}
                  <MessageRow
                    m={m} meId={meId} members={members}
                    editing={editing} setEditing={setEditing} saveEdit={saveEdit}
                    reactFor={reactFor} setReactFor={setReactFor} onReact={(e) => react(m, e)}
                    onDelete={() => del(m.id)} onReply={() => openThread(m)} showThread
                  />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {active && (
            <div style={{ borderTop: "1px solid var(--line)", padding: "12px 20px", position: "relative" }}>
              {mention && mentionList.length > 0 && (
                <div style={{ position: "absolute", bottom: 58, left: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow-hover)", overflow: "hidden", zIndex: 5, minWidth: 200 }}>
                  {mentionList.map((m) => (
                    <button key={m.id} onClick={() => pickMention(m.name)} className="fx-navitem" style={{ width: "100%", fontSize: 13 }}>
                      <span className="fx-avatar" style={{ background: m.color, width: 20, height: 20, fontSize: 9 }}>{m.name.charAt(0).toUpperCase()}</span>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="fx-btn" title="Anexar arquivo" onClick={() => fileRef.current?.click()} style={{ padding: "8px 11px" }}>📎</button>
                <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = ""; }} />
                <input className="fx-input" placeholder={active.kind === "dm" ? `Mensagem para ${active.name}` : `Mensagem em #${active.name}  (use @ para mencionar)`}
                  value={text} onChange={(e) => onTextChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button className="fx-btn fx-btn-primary" onClick={send}>Enviar</button>
              </div>
            </div>
          )}
        </div>

        {/* Painel de thread */}
        {thread && (
          <div style={{ width: 340, borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Thread</span>
              <button onClick={() => setThread(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 18 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              <MessageRow m={thread} meId={meId} members={members} editing={editing} setEditing={setEditing} saveEdit={saveEdit}
                reactFor={reactFor} setReactFor={setReactFor} onReact={(e) => react(thread, e)} onDelete={() => { del(thread.id); setThread(null); }} onReply={() => {}} />
              <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0", paddingTop: 4, fontSize: 11, color: "var(--txt-faint)" }}>{replies.length} resposta(s)</div>
              {replies.map((r) => (
                <MessageRow key={r.id} m={r} meId={meId} members={members} editing={editing} setEditing={setEditing} saveEdit={saveEdit}
                  reactFor={reactFor} setReactFor={setReactFor} onReact={(e) => react(r, e, true)} onDelete={() => del(r.id, true)} onReply={() => {}} />
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--line)", padding: "10px 14px", display: "flex", gap: 8 }}>
              <input className="fx-input" placeholder="Responder…" value={threadText} onChange={(e) => setThreadText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} />
              <button className="fx-btn fx-btn-primary" onClick={sendReply}>↑</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Header({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 6px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt-faint)" }}>{label}</span>
      <button onClick={onAdd} title={`Novo em ${label}`} style={{ background: "none", border: "none", color: "var(--roxo)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>+</button>
    </div>
  );
}

function renderText(text: string, members: Member[], mine?: boolean) {
  // Realça @menções (cor contrastante quando o balão é meu/roxo)
  const parts = text.split(/(@[\p{L}\d_.-]+)/u);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      const name = p.slice(1).toLowerCase();
      const hit = members.some((m) => m.name.split(" ")[0].toLowerCase().startsWith(name));
      if (hit) return <span key={i} style={{ color: mine ? "#f3d9a7" : "var(--roxo)", fontWeight: 700 }}>{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

function MessageRow({
  m, meId, members, editing, setEditing, saveEdit, reactFor, setReactFor, onReact, onDelete, onReply, showThread,
}: {
  m: Msg; meId: string; members: Member[];
  editing: { id: string; val: string } | null; setEditing: (e: { id: string; val: string } | null) => void; saveEdit: () => void;
  reactFor: string | null; setReactFor: (id: string | null) => void; onReact: (emoji: string) => void;
  onDelete: () => void; onReply: () => void; showThread?: boolean;
}) {
  const mine = m.user?.id === meId;
  const d = new Date(m.createdAt);
  const grouped: Record<string, { emoji: string; mine: boolean; n: number }> = {};
  for (const r of m.reactions || []) {
    grouped[r.emoji] = grouped[r.emoji] || { emoji: r.emoji, mine: false, n: 0 };
    grouped[r.emoji].n++;
    if (r.userId === meId) grouped[r.emoji].mine = true;
  }

  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const bubbleBg = mine ? "var(--roxo)" : "var(--surface)";
  const bubbleFg = mine ? "#fff" : "var(--txt)";
  const metaColor = mine ? "rgba(255,255,255,.72)" : "var(--txt-faint)";

  if (editing?.id === m.id) {
    return (
      <div className="fx-msg" style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginTop: 8 }}>
        <input className="fx-input" autoFocus value={editing.val} onChange={(e) => setEditing({ id: m.id, val: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }} onBlur={saveEdit} style={{ maxWidth: "72%" }} />
      </div>
    );
  }

  return (
    <div className="fx-msg" style={{ display: "flex", gap: 8, marginTop: 8, position: "relative", justifyContent: mine ? "flex-end" : "flex-start" }}>
      {!mine && <span className="fx-avatar" style={{ background: m.user?.color || "var(--roxo)", flexShrink: 0, alignSelf: "flex-end" }}>{(m.user?.name || "?").charAt(0).toUpperCase()}</span>}
      <div style={{ maxWidth: "72%", minWidth: 0, position: "relative", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
        <div style={{ background: bubbleBg, color: bubbleFg, border: mine ? "none" : "1px solid var(--line)", borderRadius: 15, borderBottomRightRadius: mine ? 4 : 15, borderBottomLeftRadius: mine ? 15 : 4, padding: "7px 11px 5px", boxShadow: "0 1px 1px rgba(0,0,0,.05)" }}>
          {!mine && <div style={{ fontSize: 11.5, fontWeight: 700, color: m.user?.color || "var(--roxo)", marginBottom: 2 }}>{m.user?.name || "Desconhecido"}</div>}
          {m.text && <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderText(m.text, members, mine)}</div>}
          {m.attachments?.map((a) => (
            a.mime.startsWith("image/") ? (
              <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                <img src={`/api/attachments/${a.id}`} alt={a.filename} style={{ maxWidth: 240, maxHeight: 200, borderRadius: 10, marginTop: 5, display: "block" }} />
              </a>
            ) : (
              <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 5, padding: "7px 11px", border: `1px solid ${mine ? "rgba(255,255,255,.3)" : "var(--line)"}`, borderRadius: 10, fontSize: 13, color: bubbleFg, textDecoration: "none", background: mine ? "rgba(255,255,255,.1)" : "var(--col)" }}>
                📄 {a.filename}
              </a>
            )
          ))}
          <div style={{ fontSize: 10.5, textAlign: "right", marginTop: 2, color: metaColor }}>{m.editedAt ? "editado · " : ""}{hora}</div>
        </div>

        {/* Reações */}
        {Object.keys(grouped).length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
            {Object.values(grouped).map((g) => (
              <button key={g.emoji} onClick={() => onReact(g.emoji)}
                style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12.5, padding: "1px 8px", borderRadius: 999, cursor: "pointer", border: `1px solid ${g.mine ? "var(--roxo)" : "var(--line)"}`, background: g.mine ? "rgba(146,80,172,.12)" : "var(--surface)" }}>
                {g.emoji} <span style={{ fontSize: 11, color: "var(--txt-soft)" }}>{g.n}</span>
              </button>
            ))}
          </div>
        )}

        {/* Contador de thread */}
        {showThread && !!m._count?.replies && (
          <button onClick={onReply} style={{ marginTop: 4, background: "none", border: "none", color: "var(--roxo)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: 0 }}>
            💬 {m._count.replies} resposta(s)
          </button>
        )}

        {/* Ações no hover */}
        <div className="fx-msg-actions" style={{ position: "absolute", top: -12, [mine ? "left" : "right"]: 0, display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 2, boxShadow: "var(--shadow-card)", zIndex: 4 } as React.CSSProperties}>
          <div style={{ position: "relative" }}>
            <button title="Reagir" onClick={() => setReactFor(reactFor === m.id ? null : m.id)} style={actBtn}>😀</button>
            {reactFor === m.id && (
              <div style={{ position: "absolute", bottom: 28, right: 0, display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 5, boxShadow: "var(--shadow-hover)", zIndex: 6 }}>
                {EMOJIS.map((e) => <button key={e} onClick={() => onReact(e)} style={{ ...actBtn, fontSize: 16 }}>{e}</button>)}
              </div>
            )}
          </div>
          {showThread && <button title="Responder" onClick={onReply} style={actBtn}>💬</button>}
          {mine && <button title="Editar" onClick={() => setEditing({ id: m.id, val: m.text })} style={actBtn}>✏️</button>}
          {mine && <button title="Apagar" onClick={onDelete} style={actBtn}>🗑️</button>}
        </div>
      </div>
    </div>
  );
}

const actBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "3px 5px", borderRadius: 6 };
