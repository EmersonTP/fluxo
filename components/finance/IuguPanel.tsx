"use client";
import { useState, useEffect, useCallback } from "react";
import { Field } from "./ui";

export function IuguPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; accountId: string | null; testMode: boolean; lastSyncAt: string | null }>({ connected: false, accountId: null, testMode: false, lastSyncAt: null });
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/iugu?company=${companyId}`).then((r) => r.json()).then((d) => setStatus(d)).finally(() => setLoaded(true));
  }, [companyId]);
  useEffect(load, [load]);

  async function connect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/iugu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, apiToken: token.trim(), accountId: accountId.trim() || null, testMode }) });
    const d = await res.json();
    setBusy(false);
    if (res.ok) { setToken(""); setMsg(d.webhookRegistered ? "Iugu conectada e webhook registrado ✓" : "Iugu conectada ✓ (webhook manual no painel da Iugu)"); load(); }
    else setErr(d.error || "Não foi possível conectar.");
  }
  async function disconnect() {
    if (!confirm("Desconectar a Iugu desta empresa?")) return;
    await fetch(`/api/finance/iugu?company=${companyId}`, { method: "DELETE" });
    load();
  }

  if (!loaded) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;

  return (
    <>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}
      {status.connected ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 620, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50" }} />
            <b style={{ fontSize: 14 }}>Iugu conectada</b>
            {status.testMode && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 7px" }}>modo teste</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>Conta: {status.accountId || "—"}</div>
          {isAdmin && <button className="fx-btn" style={{ marginTop: 12, color: "var(--coral-deep)" }} onClick={disconnect}>Desconectar</button>}
        </div>
      ) : isAdmin ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 620 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Conectar Iugu</div>
          <Field label="API Token"><input className="fx-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cole o token da Iugu" autoComplete="off" /></Field>
          <Field label="Account ID (opcional)"><input className="fx-input" value={accountId} onChange={(e) => setAccountId(e.target.value)} /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt-soft)", margin: "4px 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--roxo)" }} />
            Token de teste (sandbox)
          </label>
          <button className="fx-btn fx-btn-primary" disabled={busy || token.trim().length < 10} onClick={connect}>{busy ? "Conectando…" : "Conectar e validar"}</button>
        </div>
      ) : (
        <p style={{ color: "var(--txt-faint)" }}>A Iugu ainda não foi conectada. Peça a um admin.</p>
      )}
    </>
  );
}

/* ---------- Nova solicitação ---------- */
