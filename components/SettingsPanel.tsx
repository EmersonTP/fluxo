"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const AVATAR_COLORS = ["#9250ac", "#ff7e59", "#1d9e75", "#534ab7", "#d85a30", "#3b82f6", "#ec4899", "#f59e0b", "#14b8a6", "#ef4444"];

export default function SettingsPanel({
  name: initialName,
  email,
  role,
  isAdmin,
  color: initialColor,
}: {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  color: string;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [dark, setDark] = useState(false);
  const [notif, setNotif] = useState({ assigned: true, mentions: true, daily: false });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    try {
      setDark(localStorage.getItem("fluxo:theme") === "dark");
      const n = localStorage.getItem("fluxo:notif");
      if (n) setNotif(JSON.parse(n));
      setOrigin(window.location.origin);
    } catch {}
    fetch("/api/account/token").then((r) => r.json()).then((d) => setToken(d.token || null)).catch(() => {});
  }, []);

  async function genToken() {
    const d = await fetch("/api/account/token", { method: "POST" }).then((r) => r.json());
    setToken(d.token);
  }
  async function revokeToken() {
    if (!confirm("Revogar seu token? O conector do Claude vai parar de funcionar até você gerar outro.")) return;
    await fetch("/api/account/token", { method: "DELETE" });
    setToken(null);
  }
  const connectorUrl = token ? `${origin}/api/mcp?key=${token}` : "";

  function flash(setter: (v: string) => void, text: string) {
    setter(text);
    setTimeout(() => setter(""), 2500);
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("fluxo:theme", next ? "dark" : "light");
    } catch {}
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  }

  function setNotifKey(key: keyof typeof notif, val: boolean) {
    const next = { ...notif, [key]: val };
    setNotif(next);
    try {
      localStorage.setItem("fluxo:notif", JSON.stringify(next));
    } catch {}
  }

  async function saveProfile() {
    setMsg("");
    setErr("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const d = await res.json();
    if (res.ok) flash(setMsg, "Perfil atualizado.");
    else flash(setErr, d.error || "Erro.");
  }

  async function savePassword() {
    setMsg("");
    setErr("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const d = await res.json();
    if (res.ok) {
      flash(setMsg, "Senha alterada.");
      setCurrentPassword("");
      setNewPassword("");
    } else flash(setErr, d.error || "Erro.");
  }

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Geral</div>
          <div className="fx-title">Configurações</div>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 26px", maxWidth: 640 }}>
        {msg && <p style={{ color: "var(--sage)", fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        {err && <p style={{ color: "var(--coral-deep)", fontSize: 14, marginBottom: 12 }}>{err}</p>}

        <Section title="Minha conta">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
            <span className="fx-avatar" style={{ width: 56, height: 56, fontSize: 22, background: color }}>
              {name.charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--txt-soft)", marginBottom: 6 }}>Cor do avatar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--txt)" : "2px solid var(--line)", cursor: "pointer" }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <Field label="Nome">
            <input className="fx-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </Field>
          <Field label="E-mail">
            <input className="fx-input" value={email} disabled style={{ opacity: 0.6 }} />
          </Field>
          <Field label="Papel">
            <input className="fx-input" value={role} disabled style={{ opacity: 0.6 }} />
          </Field>
          <button className="fx-btn fx-btn-primary" onClick={saveProfile}>
            Salvar perfil
          </button>
        </Section>

        <Section title="Trocar senha">
          <Field label="Senha atual">
            <input className="fx-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="Nova senha">
            <input className="fx-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <button className="fx-btn fx-btn-primary" onClick={savePassword}>
            Alterar senha
          </button>
        </Section>

        <Section title="Notificações">
          <Toggle label="Avisar quando uma tarefa for atribuída a mim" checked={notif.assigned} onChange={(v) => setNotifKey("assigned", v)} />
          <Toggle label="Avisar menções no chat" checked={notif.mentions} onChange={(v) => setNotifKey("mentions", v)} />
          <Toggle label="Resumo diário das minhas tarefas" checked={notif.daily} onChange={(v) => setNotifKey("daily", v)} />
        </Section>

        <Section title="Aparência">
          <button className="fx-btn" onClick={toggleTheme}>
            {dark ? "☀️ Mudar para modo claro" : "🌙 Mudar para modo escuro"}
          </button>
        </Section>

        <Section title="Conectar ao Claude (IA por comando)">
          <p style={{ fontSize: 13.5, color: "var(--txt-soft)", margin: 0 }}>
            Essa é a <b>sua chave pessoal</b> — todo mundo do time gera a sua aqui, você <b>não</b> precisa de chave do admin. Adicione a URL como conector no Claude e peça pra ele criar/mover/buscar tarefas: ele age <b>como você</b>, respeitando só o que você tem acesso.
          </p>
          {!token ? (
            <button className="fx-btn fx-btn-primary" onClick={genToken}>Gerar meu token</button>
          ) : (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>Sua URL de conector (cole no Claude → Conectores → Adicionar conector personalizado):</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="fx-input" readOnly value={connectorUrl} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
                <button className="fx-btn" onClick={() => navigator.clipboard?.writeText(connectorUrl)}>Copiar</button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--coral-deep)" }}>
                ⚠️ Esse link é secreto (é a sua chave). Não compartilhe com ninguém.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="fx-btn" onClick={genToken}>Gerar novo (invalida o atual)</button>
                <button className="fx-btn" style={{ color: "var(--coral-deep)" }} onClick={revokeToken}>Revogar</button>
              </div>
            </div>
          )}
        </Section>

        {isAdmin && (
          <Section title="Equipe & Empresas">
            <p style={{ fontSize: 13.5, color: "var(--txt-soft)", margin: 0 }}>
              Gerencie usuários (aprovar, papéis, empresas) e crie novas empresas no painel de administração.
            </p>
            <Link href="/admin" className="fx-btn fx-btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
              Abrir Administração
            </Link>
          </Section>
        )}

        {isAdmin && <AdminActivity />}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "18px 20px", marginBottom: 18 }}>
      <div className="serif" style={{ fontSize: 17, fontWeight: 500, marginBottom: 14 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontSize: 12, color: "var(--txt-soft)", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "var(--txt)", width: "100%" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--roxo)" }} />
      {label}
    </label>
  );
}

type Act = {
  id: string;
  type: string;
  text: string;
  createdAt: string;
  user?: { id: string; name: string; color: string } | null;
  task?: { id: string; name: string; listId: string; list?: { name: string } | null } | null;
};
type Mem = { id: string; name: string };

const ACT_ICON: Record<string, string> = {
  created: "✨", renamed: "✏️", status: "🔄", priority: "🚩", assignees: "👤", due: "📅", moved: "↔️", comment: "💬",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function AdminActivity() {
  const [acts, setActs] = useState<Act[]>([]);
  const [members, setMembers] = useState<Mem[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  function load(userId = "") {
    setLoading(true);
    fetch(`/api/admin/activity${userId ? `?user=${userId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setActs(d.activities || []))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    fetch("/api/members").then((r) => r.json()).then((d) => setMembers(d.members || []));
  }, []);

  return (
    <Section title="Atividade da equipe (quem está mexendo)">
      <p style={{ fontSize: 13.5, color: "var(--txt-soft)", margin: 0 }}>
        Acompanhe o que cada pessoa fez nos espaços: criou, moveu, mudou status, comentou…
      </p>
      <div style={{ width: "100%" }}>
        <select
          className="fx-input"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); load(e.target.value); }}
          style={{ maxWidth: 240 }}
        >
          <option value="">Todas as pessoas</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2, maxHeight: 360, overflowY: "auto" }}>
        {loading && <p style={{ fontSize: 13, color: "var(--txt-faint)" }}>Carregando…</p>}
        {!loading && acts.length === 0 && <p style={{ fontSize: 13, color: "var(--txt-faint)" }}>Nenhuma atividade ainda.</p>}
        {acts.map((a) => (
          <a
            key={a.id}
            href={a.task ? `/list/${a.task.listId}?task=${a.task.id}` : "#"}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit", fontSize: 13.5 }}
          >
            <span className="fx-avatar" style={{ background: a.user?.color || "var(--roxo)", width: 24, height: 24, fontSize: 10, flexShrink: 0 }}>
              {(a.user?.name || "?").charAt(0).toUpperCase()}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{a.user?.name || "Alguém"}</b> {ACT_ICON[a.type] || "•"} {a.text}
              {a.task && <span style={{ color: "var(--txt-faint)" }}> · {a.task.name}</span>}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--txt-faint)", flexShrink: 0 }}>{timeAgo(a.createdAt)}</span>
          </a>
        ))}
      </div>
    </Section>
  );
}
