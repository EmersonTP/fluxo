"use client";
import { useState, useEffect, useCallback } from "react";
import { Row, Field, Section } from "./ui";

export function MembershipsTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  type Plano = { id: string; nome: string; valor: number; intervalo: number; intervaloTipo: string; ativo: boolean; assinaturas: number };
  type Assin = { id: string; status: string; proximaCobranca: string | null; cliente: string; plano: string; valor: number };
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assin, setAssin] = useState<Assin[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string; documento?: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [np, setNp] = useState({ nome: "", valor: "" });
  const [nc, setNc] = useState({ nome: "", email: "", documento: "", rg: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", consentimentoLGPD: false });
  const [docsCli, setDocsCli] = useState<string>("");
  const [docs, setDocs] = useState<any[]>([]);
  const [docTipo, setDocTipo] = useState("contrato");
  const [docMsg, setDocMsg] = useState("");
  const [na, setNa] = useState({ clienteId: "", planoId: "", proximaCobranca: "", valor: "", diaCobranca: "" });
  const [links, setLinks] = useState<{ id: string; token: string; label: string | null; ativo: boolean; usos: number; plano: string; valor: number }[]>([]);
  const [nl, setNl] = useState({ planoId: "", valor: "", diaCobranca: "", label: "" });
  const [copiado, setCopiado] = useState("");
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(() => {
    fetch(`/api/finance/planos?company=${companyId}`).then((r) => r.json()).then((d) => setPlanos(d.planos || []));
    fetch(`/api/finance/assinaturas?company=${companyId}`).then((r) => r.json()).then((d) => setAssin(d.assinaturas || []));
    fetch(`/api/finance/clientes?company=${companyId}`).then((r) => r.json()).then((d) => setClientes(d.clientes || []));
    fetch(`/api/finance/onboarding-links?company=${companyId}`).then((r) => r.json()).then((d) => setLinks(d.links || []));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function addPlano() { if (!np.nome.trim() || !Number(np.valor)) return; await fetch("/api/finance/planos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, nome: np.nome, valor: Number(np.valor) }) }); setNp({ nome: "", valor: "" }); load(); }
  async function delPlano(id: string) { if (!confirm("Excluir plano?")) return; await fetch(`/api/finance/planos?id=${id}`, { method: "DELETE" }); load(); }
  async function abrirDocs(id: string) { if (docsCli === id) { setDocsCli(""); return; } setDocsCli(id); setDocs([]); const d = await fetch(`/api/finance/documentos?company=${companyId}&cliente=${id}`).then((r) => r.json()); setDocs(d.documentos || []); }
  async function subirDoc(id: string, file: File) {
    setDocMsg("Enviando…");
    const b64: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
    const r = await fetch("/api/finance/documentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, clienteId: id, tipo: docTipo, filename: file.name, mime: file.type, base64: b64 }) });
    const d = await r.json(); setDocMsg(r.ok ? "Enviado." : (d.error || "Erro."));
    const dd = await fetch(`/api/finance/documentos?company=${companyId}&cliente=${id}`).then((x) => x.json()); setDocs(dd.documentos || []);
  }
  async function delDoc(docId: string, cliId: string) { if (!confirm("Excluir documento?")) return; await fetch(`/api/finance/documentos/${docId}`, { method: "DELETE" }); const dd = await fetch(`/api/finance/documentos?company=${companyId}&cliente=${cliId}`).then((x) => x.json()); setDocs(dd.documentos || []); }
  async function addCliente() { if (!nc.nome.trim()) return; await fetch("/api/finance/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...nc }) }); setNc({ nome: "", email: "", documento: "", rg: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", consentimentoLGPD: false }); load(); }
  async function addAssin() { if (!na.clienteId || !na.planoId) return; await fetch("/api/finance/assinaturas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...na }) }); setNa({ clienteId: "", planoId: "", proximaCobranca: "", valor: "", diaCobranca: "" }); load(); }
  async function delCliente(id: string) { if (!confirm("Excluir cliente? (precisa não ter títulos a receber)")) return; const r = await fetch(`/api/finance/clientes?id=${id}`, { method: "DELETE" }); if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error || "Erro ao excluir."); } load(); }
  async function cancelAssin(id: string) { if (!confirm("Cancelar assinatura?")) return; await fetch(`/api/finance/assinaturas?id=${id}`, { method: "DELETE" }); load(); }
  async function addLink() { if (!nl.planoId) return; await fetch("/api/finance/onboarding-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...nl }) }); setNl({ planoId: "", valor: "", diaCobranca: "", label: "" }); load(); }
  async function delLink(id: string) { if (!confirm("Desativar este link?")) return; await fetch(`/api/finance/onboarding-links?id=${id}`, { method: "DELETE" }); load(); }
  function linkUrl(token: string) { return `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro/${token}`; }
  async function copiar(token: string) { try { await navigator.clipboard.writeText(linkUrl(token)); setCopiado(token); setTimeout(() => setCopiado(""), 1500); } catch { /* */ } }
  async function gerarMes() { setMsg("Gerando…"); const r = await fetch("/api/finance/receber/gerar-mes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) }); const d = await r.json(); setMsg(r.ok ? `Gerados ${d.criados} títulos do mês (${d.pulados} já existiam/sem vencimento).` : (d.error || "Erro.")); }

  if (!isAdmin) return <p style={{ color: "var(--txt-faint)" }}>Apenas administradores gerenciam memberships.</p>;
  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 16, maxWidth: 720 }}><b>Memberships (recorrente).</b> Cada cliente vira uma assinatura de um plano. No início do mês você gera os títulos a receber de todas as assinaturas ativas com um clique.</div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14, maxWidth: 640 }}>{msg}</div>}
      <button className="fx-btn fx-btn-primary" onClick={gerarMes} style={{ marginBottom: 18 }}>Gerar títulos do mês</button>

      <Section title="Link de cadastro (paciente se cadastra sozinho)">
        <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 10, maxWidth: 700 }}>Gere um link por plano e mande pro paciente. Ele preenche os dados, aceita o contrato e a Sandra já cria o cadastro, a assinatura e a 1ª conta a receber.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {links.filter((l) => l.ativo).map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><b>{l.label || l.plano}</b> <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>· {money(l.valor)} · {l.usos} cadastro(s)</span><div style={{ fontSize: 11.5, color: "var(--txt-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkUrl(l.token)}</div></div>
              <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => copiar(l.token)}>{copiado === l.token ? "Copiado!" : "Copiar link"}</button>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => delLink(l.id)}>Desativar</button>
            </div>
          ))}
          {links.filter((l) => l.ativo).length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum link ativo.</p>}
        </div>
        <Row><Field label="Plano"><select className="fx-input" value={nl.planoId} onChange={(e) => setNl({ ...nl, planoId: e.target.value })}><option value="">— selecione —</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Field>
          <Field label="Valor (R$) — opcional"><input className="fx-input" type="number" value={nl.valor} onChange={(e) => setNl({ ...nl, valor: e.target.value })} placeholder="usa o do plano" /></Field>
          <Field label="Dia cobrança"><input className="fx-input" type="number" value={nl.diaCobranca} onChange={(e) => setNl({ ...nl, diaCobranca: e.target.value })} placeholder="ex.: 5" /></Field></Row>
        <button className="fx-btn" disabled={!nl.planoId} onClick={addLink}>+ Gerar link</button>
      </Section>

      <Section title="Planos">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {planos.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1 }}><b>{p.nome}</b><div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{money(p.valor)} / {p.intervalo > 1 ? p.intervalo + " " : ""}{p.intervaloTipo === "weeks" ? "semana(s)" : "mês"} · {p.assinaturas} assinante(s)</div></div>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => delPlano(p.id)}>Excluir</button>
            </div>
          ))}
          {planos.length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum plano ainda.</p>}
        </div>
        <Row><Field label="Nome do plano"><input className="fx-input" value={np.nome} onChange={(e) => setNp({ ...np, nome: e.target.value })} placeholder="ex.: Membership Emerson" /></Field>
          <Field label="Valor mensal (R$)"><input className="fx-input" type="number" value={np.valor} onChange={(e) => setNp({ ...np, valor: e.target.value })} /></Field></Row>
        <button className="fx-btn" disabled={!np.nome.trim() || !Number(np.valor)} onClick={addPlano}>+ Adicionar plano</button>
      </Section>

      <Section title="Clientes / Pacientes">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {clientes.map((c) => (
            <div key={c.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1 }}><b>{c.nome}</b>{c.documento ? <span style={{ fontSize: 12, color: "var(--txt-faint)" }}> · {c.documento}</span> : null}</div>
              <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => abrirDocs(c.id)}>Documentos</button>
              <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={`/api/finance/clientes/${c.id}/contrato`} target="_blank" rel="noopener">Gerar contrato</a>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => delCliente(c.id)}>Excluir</button>
            </div>
            {docsCli === c.id && (
              <div style={{ border: "1px solid var(--line)", borderTop: "none", borderRadius: "0 0 var(--r-card) var(--r-card)", padding: "10px 14px", background: "var(--bg-soft, rgba(0,0,0,.02))" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <select className="fx-input" style={{ maxWidth: 150 }} value={docTipo} onChange={(e) => setDocTipo(e.target.value)}><option value="contrato">Contrato</option><option value="nf">NF</option><option value="comprovante">Comprovante</option><option value="outro">Outro</option></select>
                  <label className="fx-btn" style={{ fontSize: 12, cursor: "pointer" }}>Subir arquivo<input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(c.id, f); e.currentTarget.value = ""; }} /></label>
                  {docMsg && <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{docMsg}</span>}
                  <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>protegido · LGPD · auditado</span>
                </div>
                {docs.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--txt-faint)", margin: 0 }}>Nenhum documento ainda.</p> : docs.map((d) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#7a4fb0", background: "rgba(146,80,172,.12)", borderRadius: 999, padding: "1px 7px", textTransform: "uppercase" }}>{d.tipo}</span>
                    <a href={`/api/finance/documentos/${d.id}`} target="_blank" rel="noopener" style={{ flex: 1, color: "var(--txt)" }}>{d.filename}</a>
                    <span style={{ color: "var(--txt-faint)" }}>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
                    <button className="fx-btn" style={{ fontSize: 11, color: "var(--coral-deep)" }} onClick={() => delDoc(d.id, c.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
            </div>
          ))}
          {clientes.length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum cliente cadastrado.</p>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--txt-soft)", marginBottom: 6 }}>+ Novo cliente / paciente</div>
        <Row><Field label="Nome completo*"><input className="fx-input" value={nc.nome} onChange={(e) => setNc({ ...nc, nome: e.target.value })} /></Field>
          <Field label="CPF/CNPJ"><input className="fx-input" value={nc.documento} onChange={(e) => setNc({ ...nc, documento: e.target.value })} /></Field>
          <Field label="RG"><input className="fx-input" value={nc.rg} onChange={(e) => setNc({ ...nc, rg: e.target.value })} /></Field></Row>
        <Row><Field label="E-mail"><input className="fx-input" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field>
          <Field label="CEP"><input className="fx-input" value={nc.cep} onChange={(e) => setNc({ ...nc, cep: e.target.value })} /></Field></Row>
        <Row><Field label="Logradouro"><input className="fx-input" value={nc.logradouro} onChange={(e) => setNc({ ...nc, logradouro: e.target.value })} /></Field>
          <Field label="Número"><input className="fx-input" value={nc.numero} onChange={(e) => setNc({ ...nc, numero: e.target.value })} /></Field>
          <Field label="Complemento"><input className="fx-input" value={nc.complemento} onChange={(e) => setNc({ ...nc, complemento: e.target.value })} /></Field></Row>
        <Row><Field label="Bairro"><input className="fx-input" value={nc.bairro} onChange={(e) => setNc({ ...nc, bairro: e.target.value })} /></Field>
          <Field label="Cidade"><input className="fx-input" value={nc.cidade} onChange={(e) => setNc({ ...nc, cidade: e.target.value })} /></Field>
          <Field label="UF"><input className="fx-input" value={nc.uf} onChange={(e) => setNc({ ...nc, uf: e.target.value })} maxLength={2} /></Field></Row>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--txt-soft)", marginBottom: 10 }}><input type="checkbox" checked={nc.consentimentoLGPD} onChange={(e) => setNc({ ...nc, consentimentoLGPD: e.target.checked })} /> Consentimento LGPD registrado (execução de contrato)</label>
        <button className="fx-btn" disabled={!nc.nome.trim()} onClick={addCliente}>+ Adicionar cliente</button>
      </Section>

      <Section title="Assinaturas ativas">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {assin.filter((a) => a.status === "ativa").map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1 }}><b>{a.cliente}</b> · {a.plano}<div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{money(a.valor)} · próxima {a.proximaCobranca ? new Date(a.proximaCobranca).toLocaleDateString("pt-BR") : "—"}</div></div>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => cancelAssin(a.id)}>Cancelar</button>
            </div>
          ))}
          {assin.filter((a) => a.status === "ativa").length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhuma assinatura ativa.</p>}
        </div>
        <Row><Field label="Cliente"><select className="fx-input" value={na.clienteId} onChange={(e) => setNa({ ...na, clienteId: e.target.value })}><option value="">— selecione —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
          <Field label="Plano"><select className="fx-input" value={na.planoId} onChange={(e) => setNa({ ...na, planoId: e.target.value })}><option value="">— selecione —</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Field></Row>
        <Row><Field label="Valor mensal (R$)"><input className="fx-input" type="number" value={na.valor} onChange={(e) => setNa({ ...na, valor: e.target.value })} placeholder="usa o do plano se vazio" /></Field>
          <Field label="Dia de cobrança"><input className="fx-input" type="number" value={na.diaCobranca} onChange={(e) => setNa({ ...na, diaCobranca: e.target.value })} placeholder="ex.: 5" /></Field>
          <Field label="1ª cobrança"><input className="fx-input" type="date" value={na.proximaCobranca} onChange={(e) => setNa({ ...na, proximaCobranca: e.target.value })} /></Field></Row>
        <button className="fx-btn" disabled={!na.clienteId || !na.planoId} onClick={addAssin}>+ Criar assinatura</button>
      </Section>
    </>
  );
}

/* ---------- Cobrança (gateway: boleto/PIX/cartão) ---------- */
