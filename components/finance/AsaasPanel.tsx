"use client";
import { useState, useEffect, useCallback } from "react";
import { Row, Field, BRLcents } from "./ui";

export function AsaasPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<{ connected: boolean; testMode: boolean; lastSyncAt: string | null }>({ connected: false, testMode: false, lastSyncAt: null });
  const [recebiveis, setRecebiveis] = useState<{ id: string; descricao: string; valorCents: number; status: string; secureUrl: string | null; createdAt: string }[]>([]);
  const [token, setToken] = useState(""); const [testMode, setTestMode] = useState(true);
  const [cob, setCob] = useState({ valorReais: "", descricao: "", devedorNome: "", devedorDoc: "", billingType: "BOLETO", vencimento: "" });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/asaas?company=${companyId}`).then((r) => r.json()).then((d) => setSt(d)).finally(() => setLoaded(true));
    fetch(`/api/finance/asaas/cobranca?company=${companyId}`).then((r) => r.json()).then((d) => setRecebiveis(d.recebiveis || [])).catch(() => {});
  }, [companyId]);
  useEffect(load, [load]);

  async function connect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/asaas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, apiToken: token.trim(), testMode }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setToken(""); setMsg(d.webhookRegistered ? "Asaas conectada e webhook registrado ✓" : `Asaas conectada ✓ (webhook não registrou: ${d.webhookError || "configure no painel da Asaas"})`); load(); }
    else setErr(d.error || "Não foi possível conectar.");
  }
  async function disconnect() {
    if (!confirm("Desconectar a Asaas? Os recebíveis já registrados continuam salvos.")) return;
    await fetch(`/api/finance/asaas?company=${companyId}`, { method: "DELETE" }); load();
  }
  async function emitir() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/asaas/cobranca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...cob }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setCob({ valorReais: "", descricao: "", devedorNome: "", devedorDoc: "", billingType: "BOLETO", vencimento: "" }); setMsg("Cobrança criada ✓"); load(); }
    else setErr(d.error || "Erro ao emitir.");
  }

  if (!loaded) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 640 }}>
        Recebimento via <b>Asaas</b> — boleto, PIX e cartão (com link de pagamento e parcelamento). A cobrança nasce na Sandra e o pagamento confirma por webhook.
      </div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}

      {st.connected ? (
        <>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, background: "var(--surface)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50" }} />
              <b style={{ fontSize: 14 }}>Asaas conectada</b>
              {st.testMode && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 7px" }}>sandbox</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>Última sincronização: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString("pt-BR") : "ainda sem eventos"}</div>
            {isAdmin && <button className="fx-btn" style={{ marginTop: 12, color: "var(--coral-deep)" }} onClick={disconnect}>Desconectar</button>}
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Nova cobrança</div>
            <Row><Field label="Valor (R$)*"><input className="fx-input" type="number" value={cob.valorReais} onChange={(e) => setCob({ ...cob, valorReais: e.target.value })} /></Field>
              <Field label="Vencimento*"><input className="fx-input" type="date" value={cob.vencimento} onChange={(e) => setCob({ ...cob, vencimento: e.target.value })} /></Field></Row>
            <Row><Field label="Forma"><select className="fx-input" value={cob.billingType} onChange={(e) => setCob({ ...cob, billingType: e.target.value })}><option value="BOLETO">Boleto</option><option value="PIX">PIX</option><option value="CREDIT_CARD">Cartão</option><option value="UNDEFINED">Cliente escolhe</option></select></Field>
              <Field label="Descrição"><input className="fx-input" value={cob.descricao} onChange={(e) => setCob({ ...cob, descricao: e.target.value })} placeholder="ex.: Mensalidade junho" /></Field></Row>
            <Row><Field label="Pagador (nome)*"><input className="fx-input" value={cob.devedorNome} onChange={(e) => setCob({ ...cob, devedorNome: e.target.value })} /></Field>
              <Field label="CPF/CNPJ do pagador"><input className="fx-input" value={cob.devedorDoc} onChange={(e) => setCob({ ...cob, devedorDoc: e.target.value })} /></Field></Row>
            <button className="fx-btn fx-btn-primary" disabled={busy || !Number(cob.valorReais) || !cob.devedorNome || !cob.vencimento} onClick={emitir}>{busy ? "Emitindo…" : "Emitir cobrança"}</button>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Recebíveis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 720 }}>
            {recebiveis.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhuma cobrança ainda.</p>}
            {recebiveis.map((r) => {
              const tone = r.status === "paga" ? { bg: "#d7ebe2", fg: "#0f6b50" } : r.status === "vencida" ? { bg: "#f3dcd8", fg: "#a8332c" } : { bg: "#f6e7cd", fg: "#b5781f" };
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 13px", background: "var(--surface)" }}>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{r.descricao}</span>
                  {r.secureUrl && r.status !== "paga" && <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={r.secureUrl} target="_blank" rel="noreferrer">Abrir link</a>}
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{BRLcents(r.valorCents)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "2px 9px" }}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : isAdmin ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Conectar Asaas</div>
          <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>Pegue a chave de API no painel da Asaas (Integrações → API). Comece pela chave de <b>sandbox</b> pra testar. A chave fica só no servidor.</p>
          <Field label="API Key (access_token)"><input className="fx-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="$aact_..." autoComplete="off" /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt-soft)", margin: "4px 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--roxo)" }} />
            Chave de sandbox (recomendado pra testar)
          </label>
          <button className="fx-btn fx-btn-primary" disabled={busy || token.trim().length < 20} onClick={connect}>{busy ? "Validando…" : "Conectar e validar"}</button>
        </div>
      ) : (
        <p style={{ color: "var(--txt-faint)" }}>A Asaas ainda não foi conectada. Peça a um admin.</p>
      )}
    </>
  );
}


/* ---------- Inter (banco direto, Pix) ---------- */
