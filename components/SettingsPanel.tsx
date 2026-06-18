"use client";

import { useEffect, useState } from "react";

export default function SettingsPanel({ name: initialName, email, role }: { name: string; email: string; role: string }) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [dark, setDark] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      setDark(localStorage.getItem("fluxo:theme") === "dark");
    } catch {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("fluxo:theme", next ? "dark" : "light");
    } catch {}
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  }

  async function saveProfile() {
    setMsg("");
    setErr("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json();
    if (res.ok) setMsg("Nome atualizado.");
    else setErr(d.error || "Erro.");
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
      setMsg("Senha alterada.");
      setCurrentPassword("");
      setNewPassword("");
    } else setErr(d.error || "Erro.");
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

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 26px", maxWidth: 620 }}>
        {msg && <p style={{ color: "var(--sage)", fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        {err && <p style={{ color: "var(--coral-deep)", fontSize: 14, marginBottom: 12 }}>{err}</p>}

        <Section title="Minha conta">
          <Field label="Nome">
            <input className="fx-input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className="fx-input" value={email} disabled style={{ opacity: 0.6 }} />
          </Field>
          <Field label="Papel">
            <input className="fx-input" value={role} disabled style={{ opacity: 0.6 }} />
          </Field>
          <button className="fx-btn fx-btn-primary" onClick={saveProfile}>
            Salvar nome
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

        <Section title="Aparência">
          <button className="fx-btn" onClick={toggleTheme}>
            {dark ? "☀️ Mudar para modo claro" : "🌙 Mudar para modo escuro"}
          </button>
        </Section>
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
