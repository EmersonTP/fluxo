"use client";
import { useState, useEffect, useCallback } from "react";
import { Field, TabHeader } from "./ui";

export function SegurancaTab({ companyId }: { companyId: string }) {
  const [data, setData] = useState<{ logs: { id: string; at: string; userName: string | null; action: string; entity: string; entityId: string | null; ip: string | null; meta: string | null }[]; encryption: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/audit?company=${companyId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [companyId]);

  // PIN de pagamento (o proprio usuario define; nunca devolvemos o PIN)
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");
  const [pinMsg, setPinMsg] = useState(""); const [savingPin, setSavingPin] = useState(false);
  const loadPin = useCallback(() => { fetch(`/api/finance/payment-pin`).then((r) => r.json()).then((d) => setHasPin(!!d.hasPin)).catch(() => {}); }, []);
  useEffect(() => { loadPin(); }, [loadPin]);
  async function salvarPin() {
    setPinMsg("");
    if (pin.length < 4 || !/^[0-9]+$/.test(pin)) { setPinMsg("Use ao menos 4 dígitos numéricos."); return; }
    if (pin !== pin2) { setPinMsg("Os dois campos não conferem."); return; }
    setSavingPin(true);
    try {
      const r = await fetch(`/api/finance/payment-pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Falha");
      setPin(""); setPin2(""); setPinMsg("PIN salvo com segurança."); loadPin();
    } catch (e: any) { setPinMsg(e.message || "Falha"); }
    setSavingPin(false);
  }

  const ACT: Record<string, { l: string; c: string }> = {
    view: { l: "consultou", c: "#274b6d" }, create: { l: "criou", c: "#0f6b50" },
    update: { l: "alterou", c: "#b5781f" }, delete: { l: "excluiu", c: "#a8332c" },
    export: { l: "exportou", c: "#7a3fa0" }, pay: { l: "pagou", c: "#a8332c" },
  };
  const ENT: Record<string, string> = { extrato: "Extrato", solicitacao: "Solicitação", cobranca: "Cobrança", recebivel: "Recebível", cliente: "Cliente/Paciente", config: "Configuração" };

  return (
    <>
      <TabHeader title="Segurança & LGPD" subtitle="Quem acessou e alterou dados sensíveis. Dado de saúde é categoria especial na LGPD — registramos tudo e protegemos." />

      {/* Estado das proteções */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 680, marginBottom: 22 }}>
        {[
          { ok: true, t: "Acesso por papel", d: "Dados financeiros e de paciente só aparecem para admin e financeiro." },
          { ok: true, t: "Trilha de auditoria", d: "Cada acesso/alteração sensível fica registrado (abaixo)." },
          { ok: data?.encryption, t: "Criptografia em repouso (CPF)", d: data?.encryption ? "Chave configurada — CPFs cifrados (AES-256-GCM)." : "Falta definir a variável DATA_ENC_KEY no servidor para ativar." },
          { ok: true, t: "Segredos protegidos", d: "Chaves do banco/gateway nunca saem do servidor." },
        ].map((x) => (
          <div key={x.t} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "11px 14px", background: "var(--surface)" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: x.ok ? "#d7ebe2" : "#f6e7cd", color: x.ok ? "#0f6b50" : "#b5781f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{x.ok ? "✓" : "!"}</span>
            <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{x.t}</div><div style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>{x.d}</div></div>
          </div>
        ))}
      </div>

      {/* PIN de pagamento */}
      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>PIN de pagamento</div>
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 16px", background: "var(--surface)", maxWidth: 480, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: hasPin ? "#d7ebe2" : "#f6e7cd", color: hasPin ? "#0f6b50" : "#b5781f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{hasPin ? "\u2713" : "!"}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{hasPin == null ? "Verificando…" : hasPin ? "PIN cadastrado" : "Você ainda não tem PIN"}</span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>O PIN confirma os pagamentos antes de saírem. É pessoal e só você o conhece — fica guardado cifrado, ninguém (nem a Sandra) consegue lê-lo.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label={hasPin ? "Novo PIN" : "PIN (mín. 4 dígitos)"}><input className="fx-input" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} maxLength={8} style={{ maxWidth: 150 }} /></Field>
          <Field label="Repita o PIN"><input className="fx-input" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))} maxLength={8} style={{ maxWidth: 150 }} /></Field>
          <button className="fx-btn fx-btn-primary" disabled={savingPin} onClick={salvarPin} style={{ marginBottom: 10 }}>{savingPin ? "Salvando…" : hasPin ? "Trocar PIN" : "Cadastrar PIN"}</button>
        </div>
        {pinMsg && <div style={{ fontSize: 12.5, color: pinMsg.includes("salvo") ? "#0f6b50" : "#a8332c", marginTop: 2 }}>{pinMsg}</div>}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Trilha de auditoria</div>
      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {data && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 820 }}>
          {data.logs.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum acesso registrado ainda.</p>}
          {data.logs.map((l) => {
            const a = ACT[l.action] || { l: l.action, c: "var(--txt-soft)" };
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "9px 13px", background: "var(--surface)", fontSize: 13 }}>
                <span style={{ color: "var(--txt-faint)", width: 116, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{new Date(l.at).toLocaleString("pt-BR")}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{l.userName || "—"}</b> <span style={{ color: a.c, fontWeight: 600 }}>{a.l}</span> {ENT[l.entity] || l.entity}{l.meta ? <span style={{ color: "var(--txt-faint)" }}> · {l.meta}</span> : ""}</span>
                <span style={{ color: "var(--txt-faint)", fontSize: 11.5, flexShrink: 0 }}>{l.ip || ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- Iugu (gateway) ---------- */
