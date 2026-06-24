"use client";

import { useEffect, useState } from "react";

type Info = { empresa?: string; plano?: string; valor?: number; diaCobranca?: number | null; error?: string };
const money = (v?: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CadastroPublico({ params }: { params: { token: string } }) {
  const token = params.token;
  const [info, setInfo] = useState<Info | null>(null);
  const [f, setF] = useState({ nome: "", documento: "", rg: "", email: "", telefone: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", aceiteContrato: false, aceiteLGPD: false });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ clienteId: string } | null>(null);

  useEffect(() => { fetch(`/api/public/cadastro/${token}`).then((r) => r.json()).then(setInfo); }, [token]);

  async function submit() {
    setErr(""); setLoading(true);
    const r = await fetch(`/api/public/cadastro/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { setErr(d.error || "Erro ao enviar."); return; }
    setDone({ clienteId: d.clienteId });
  }

  const wrap: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#1a1a2e" };
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #cdd3df", borderRadius: 10, fontSize: 15, marginTop: 4 };
  const lbl: React.CSSProperties = { fontSize: 13, color: "#555", fontWeight: 600 };
  const row: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };
  const fld = (w = 1): React.CSSProperties => ({ flex: w, minWidth: 140, marginBottom: 12 });

  if (info?.error) return <div style={wrap}><h2>Link indisponível</h2><p style={{ color: "#555" }}>{info.error}</p></div>;
  if (!info) return <div style={wrap}><p style={{ color: "#888" }}>Carregando…</p></div>;

  if (done) return (
    <div style={wrap}>
      <div style={{ background: "#e6f7ef", border: "1px solid #9fe1cb", borderRadius: 14, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>✓ Cadastro concluído!</h2>
        <p>Sua adesão à <b>{info.plano}</b> foi registrada. Agora falta assinar o contrato:</p>
        <ol style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li><a href={`/api/public/cadastro/${token}/contrato?cliente=${done.clienteId}`} target="_blank" rel="noopener"><b>Abrir seu contrato</b></a> e salvar como PDF (Imprimir → Salvar como PDF).</li>
          <li>Acesse <a href="https://assinador.iti.gov.br" target="_blank" rel="noopener">assinador.iti.gov.br</a>, entre com sua conta <b>gov.br</b> e assine o PDF.</li>
          <li>Envie o contrato assinado para a equipe da {info.empresa}.</li>
        </ol>
        <p style={{ fontSize: 13, color: "#555" }}>O boleto/Pix da primeira mensalidade será enviado ao seu e-mail.</p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, color: "#7a4fb0", fontWeight: 700, letterSpacing: ".04em" }}>{(info.empresa || "").toUpperCase()}</div>
      <h1 style={{ margin: "4px 0 2px", fontSize: 26 }}>Adesão — {info.plano}</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Mensalidade {money(info.valor)} · cobrança recorrente automática{info.diaCobranca ? ` · dia ${info.diaCobranca}` : ""}.</p>

      {err && <div style={{ background: "#fdecea", border: "1px solid #f5b5ad", color: "#a8332c", borderRadius: 10, padding: "10px 14px", margin: "12px 0" }}>{err}</div>}

      <div style={{ marginTop: 16 }}>
        <div style={row}><div style={fld(2)}><div style={lbl}>Nome completo*</div><input style={inp} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div></div>
        <div style={row}><div style={fld()}><div style={lbl}>CPF*</div><input style={inp} value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></div>
          <div style={fld()}><div style={lbl}>RG</div><input style={inp} value={f.rg} onChange={(e) => setF({ ...f, rg: e.target.value })} /></div></div>
        <div style={row}><div style={fld()}><div style={lbl}>E-mail*</div><input style={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div style={fld()}><div style={lbl}>Telefone</div><input style={inp} value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div></div>
        <div style={row}><div style={fld()}><div style={lbl}>CEP</div><input style={inp} value={f.cep} onChange={(e) => setF({ ...f, cep: e.target.value })} /></div>
          <div style={fld(2)}><div style={lbl}>Logradouro</div><input style={inp} value={f.logradouro} onChange={(e) => setF({ ...f, logradouro: e.target.value })} /></div></div>
        <div style={row}><div style={fld()}><div style={lbl}>Número</div><input style={inp} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></div>
          <div style={fld()}><div style={lbl}>Complemento</div><input style={inp} value={f.complemento} onChange={(e) => setF({ ...f, complemento: e.target.value })} /></div></div>
        <div style={row}><div style={fld()}><div style={lbl}>Bairro</div><input style={inp} value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} /></div>
          <div style={fld()}><div style={lbl}>Cidade</div><input style={inp} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></div>
          <div style={fld(0.5)}><div style={lbl}>UF</div><input style={inp} maxLength={2} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} /></div></div>

        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: "#444", margin: "8px 0" }}><input type="checkbox" checked={f.aceiteContrato} onChange={(e) => setF({ ...f, aceiteContrato: e.target.checked })} /> <span>Li e aceito o <b>Contrato de Adesão</b> da {info.empresa}, incluindo o regime de recorrência mensal automática.</span></label>
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: "#444", margin: "8px 0 16px" }}><input type="checkbox" checked={f.aceiteLGPD} onChange={(e) => setF({ ...f, aceiteLGPD: e.target.checked })} /> <span>Autorizo o tratamento dos meus dados pessoais e de saúde, nos termos da <b>LGPD</b>, para execução do contrato e tutela da saúde.</span></label>

        <button onClick={submit} disabled={loading || !f.nome.trim() || !f.documento.trim() || !f.aceiteContrato || !f.aceiteLGPD}
          style={{ width: "100%", padding: "13px", border: "none", borderRadius: 12, background: loading ? "#b9a9d6" : "#7a4fb0", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Enviando…" : "Concluir adesão"}
        </button>
        <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginTop: 12 }}>Seus dados são tratados com sigilo e protegidos conforme a LGPD.</p>
      </div>
    </div>
  );
}
