"use client";
import { useState, useEffect, useCallback } from "react";
import { Row, Field, BRLcents } from "./ui";

export function InterPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<{ connected: boolean; contaCorrente: string | null; pixKey: string | null; testMode: boolean; lastSyncAt: string | null }>({ connected: false, contaCorrente: null, pixKey: null, testMode: false, lastSyncAt: null });
  const [recebiveis, setRecebiveis] = useState<{ id: string; descricao: string; valorCents: number; status: string; pixCopiaECola: string | null; secureUrl: string | null; vencimento: string | null; createdAt: string }[]>([]);
  // form de conexão
  const [f, setF] = useState({ clientId: "", clientSecret: "", certPem: "", keyPem: "", contaCorrente: "", pixKey: "", testMode: true });
  // form de cobrança (boleto + Pix — boleto exige endereço do pagador)
  const [cob, setCob] = useState({ valorReais: "", descricao: "", vencimento: "", devedorNome: "", devedorDoc: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [diag, setDiag] = useState<{ resultados: { label: string; para: string; ok: boolean; erro: string | null }[]; podePagarPix: boolean } | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  async function rodarDiag() {
    setDiagBusy(true); setDiag(null); setErr("");
    try {
      const d = await fetch(`/api/finance/inter/diag?company=${companyId}`).then((r) => r.json());
      if (d.error) setErr(d.error); else setDiag(d);
    } catch (e: any) { setErr("Falha no diagnóstico: " + (e?.message || e)); }
    setDiagBusy(false);
  }

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/inter?company=${companyId}`).then((r) => r.json()).then((d) => setSt(d)).finally(() => setLoaded(true));
    fetch(`/api/finance/inter/cobranca?company=${companyId}`).then((r) => r.json()).then((d) => setRecebiveis(d.recebiveis || [])).catch(() => {});
  }, [companyId]);
  useEffect(load, [load]);

  async function connect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/inter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...f }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setF((x) => ({ ...x, clientSecret: "", certPem: "", keyPem: "" })); setMsg(d.webhookRegistered ? "Inter conectado e webhook de cobrança registrado ✓" : `Inter conectado ✓ (webhook não registrou: ${d.webhookError || "—"})`); load(); }
    else setErr(d.error || "Não foi possível conectar.");
  }
  async function disconnect() {
    if (!confirm("Desconectar o Inter? Os recebíveis já registrados continuam salvos.")) return;
    await fetch(`/api/finance/inter?company=${companyId}`, { method: "DELETE" }); load();
  }
  async function emitir() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/inter/cobranca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...cob }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setCob({ valorReais: "", descricao: "", vencimento: "", devedorNome: "", devedorDoc: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "" }); setMsg("Cobrança criada ✓ (boleto + Pix)"); load(); }
    else setErr(d.error || "Erro ao emitir.");
  }

  if (!loaded) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 640 }}>
        Recebimento <b>direto no Banco Inter</b> via <b>boleto com Pix</b> (mTLS, API de Cobrança). A cobrança nasce na Sandra, o cliente paga o boleto ou o QR Code Pix, e o Inter confirma por webhook — o dinheiro cai direto na conta da empresa.
      </div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}

      {st.connected ? (
        <>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, background: "var(--surface)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50" }} />
              <b style={{ fontSize: 14 }}>Inter conectado</b>
              {st.testMode && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 7px" }}>homologação</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>Chave Pix: {st.pixKey || "—"} · Conta: {st.contaCorrente || "—"}</div>
            <div style={{ fontSize: 12.5, color: "var(--txt-faint)", marginTop: 2 }}>Última sincronização: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString("pt-BR") : "ainda sem eventos"}</div>
            {isAdmin && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="fx-btn" onClick={rodarDiag} disabled={diagBusy}>{diagBusy ? "Testando escopos…" : "Diagnóstico de pagamento"}</button>
                <button className="fx-btn" style={{ color: "var(--coral-deep)" }} onClick={disconnect}>Desconectar</button>
              </div>
            )}
            {diag && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{diag.podePagarPix ? "✅ Pagamento por Pix habilitado" : "⚠ Pagamento por Pix ainda BLOQUEADO no portal do Inter"}</div>
                {diag.resultados.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                    <span style={{ fontWeight: 700, color: r.ok ? "#0f6b50" : "#a8332c" }}>{r.ok ? "✓" : "✗"}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      <div style={{ color: "var(--txt-faint)" }}>{r.ok ? r.para : (r.erro || "escopo não habilitado")}</div>
                    </div>
                  </div>
                ))}
                {!diag.podePagarPix && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--txt-soft)", background: "#f6e7cd", borderRadius: 8, padding: "8px 10px" }}>
                    Para pagar pela Sandra: entre no <b>Portal do Desenvolvedor do Inter</b> → sua aplicação → habilite os escopos <b>Pagamento Pix</b> (e <b>Pagamento de boleto</b>, se quiser pagar boleto). Depois rode o diagnóstico de novo.
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Nova cobrança (boleto + Pix)</div>
            <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>O boleto exige os dados completos do pagador (nome, CPF/CNPJ e endereço). O cliente recebe boleto e QR Code Pix na mesma cobrança.</p>
            <Row><Field label="Valor (R$)*"><input className="fx-input" type="number" value={cob.valorReais} onChange={(e) => setCob({ ...cob, valorReais: e.target.value })} /></Field>
              <Field label="Vencimento*"><input className="fx-input" type="date" value={cob.vencimento} onChange={(e) => setCob({ ...cob, vencimento: e.target.value })} /></Field></Row>
            <Field label="Descrição"><input className="fx-input" value={cob.descricao} onChange={(e) => setCob({ ...cob, descricao: e.target.value })} placeholder="ex.: Mensalidade junho" /></Field>
            <Row><Field label="Pagador (nome)*"><input className="fx-input" value={cob.devedorNome} onChange={(e) => setCob({ ...cob, devedorNome: e.target.value })} /></Field>
              <Field label="CPF/CNPJ do pagador*"><input className="fx-input" value={cob.devedorDoc} onChange={(e) => setCob({ ...cob, devedorDoc: e.target.value })} /></Field></Row>
            <Row><Field label="CEP*"><input className="fx-input" value={cob.cep} onChange={(e) => setCob({ ...cob, cep: e.target.value })} placeholder="00000-000" /></Field>
              <Field label="Endereço*"><input className="fx-input" value={cob.endereco} onChange={(e) => setCob({ ...cob, endereco: e.target.value })} placeholder="Rua / Av." /></Field></Row>
            <Row><Field label="Número"><input className="fx-input" value={cob.numero} onChange={(e) => setCob({ ...cob, numero: e.target.value })} placeholder="S/N" /></Field>
              <Field label="Bairro"><input className="fx-input" value={cob.bairro} onChange={(e) => setCob({ ...cob, bairro: e.target.value })} /></Field></Row>
            <Row><Field label="Cidade*"><input className="fx-input" value={cob.cidade} onChange={(e) => setCob({ ...cob, cidade: e.target.value })} /></Field>
              <Field label="UF*"><input className="fx-input" maxLength={2} value={cob.uf} onChange={(e) => setCob({ ...cob, uf: e.target.value.toUpperCase() })} placeholder="SC" /></Field></Row>
            <button className="fx-btn fx-btn-primary" disabled={busy || !Number(cob.valorReais) || !cob.vencimento || !cob.devedorNome || !cob.devedorDoc || !cob.cep || !cob.endereco || !cob.cidade || !cob.uf} onClick={emitir}>{busy ? "Emitindo…" : "Emitir boleto + Pix"}</button>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Recebíveis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 720 }}>
            {recebiveis.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhuma cobrança ainda.</p>}
            {recebiveis.map((r) => {
              const tone = r.status === "paga" ? { bg: "#d7ebe2", fg: "#0f6b50" } : r.status === "vencida" ? { bg: "#f3dcd8", fg: "#a8332c" } : { bg: "#f6e7cd", fg: "#b5781f" };
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 13px", background: "var(--surface)" }}>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{r.descricao}</span>
                  {r.secureUrl && r.status !== "paga" && <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={r.secureUrl} target="_blank" rel="noopener noreferrer">Boleto</a>}
                  {r.pixCopiaECola && r.status !== "paga" && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(r.pixCopiaECola || ""); setMsg("Pix copia-e-cola copiado ✓"); }}>Copiar Pix</button>}
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{BRLcents(r.valorCents)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "2px 9px" }}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : isAdmin ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Conectar Banco Inter</div>
          <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>Cole o client_id, o client_secret e a chave Pix. O <b>certificado e a chave são opcionais</b> — preencha só se a sua integração exigir mTLS (se conectar sem eles, é porque não precisa). Tudo fica guardado só no servidor.</p>
          <Row><Field label="Client ID"><input className="fx-input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} autoComplete="off" /></Field>
            <Field label="Client Secret"><input className="fx-input" type="password" value={f.clientSecret} onChange={(e) => setF({ ...f, clientSecret: e.target.value })} autoComplete="off" /></Field></Row>
          <Field label="Certificado (.crt — opcional, só se exigir mTLS)"><textarea className="fx-input" rows={3} value={f.certPem} onChange={(e) => setF({ ...f, certPem: e.target.value })} placeholder="-----BEGIN CERTIFICATE----- (deixe vazio se não tiver)" /></Field>
          <Field label="Chave privada (.key — opcional)"><textarea className="fx-input" rows={3} value={f.keyPem} onChange={(e) => setF({ ...f, keyPem: e.target.value })} placeholder="-----BEGIN PRIVATE KEY----- (deixe vazio se não tiver)" /></Field>
          <Row><Field label="Conta corrente (opcional)"><input className="fx-input" value={f.contaCorrente} onChange={(e) => setF({ ...f, contaCorrente: e.target.value })} /></Field>
            <Field label="Chave Pix de recebimento*"><input className="fx-input" value={f.pixKey} onChange={(e) => setF({ ...f, pixKey: e.target.value })} placeholder="e-mail, CNPJ ou aleatória" /></Field></Row>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt-soft)", margin: "4px 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={f.testMode} onChange={(e) => setF({ ...f, testMode: e.target.checked })} style={{ width: 15, height: 15, accentColor: "var(--roxo)" }} />
            Credenciais de homologação (recomendado pra testar antes)
          </label>
          <button className="fx-btn fx-btn-primary" disabled={busy} onClick={connect}>{busy ? "Validando com o Inter…" : "Conectar e validar"}</button>
        </div>
      ) : (
        <p style={{ color: "var(--txt-faint)" }}>O Inter ainda não foi conectado. Peça a um admin.</p>
      )}
    </>
  );
}

/* ---------- Gestão (extrato bancário Inter) ---------- */
