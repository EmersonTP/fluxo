"use client";
import { useState, useEffect, useCallback } from "react";
import { Row, Field, Section } from "./ui";

export function MembershipsTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  type Plano = { id: string; nome: string; valor: number; intervalo: number; intervaloTipo: string; ativo: boolean; assinaturas: number };
  type Assin = { id: string; clienteId?: string; status: string; proximaCobranca: string | null; cliente: string; plano: string; valor: number };
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
  const [nm, setNm] = useState({ nome: "", documento: "", email: "", telefone: "", cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", planoId: "", valor: "", recorrencia: "mensal", diaCobranca: "", vencimento: "", consentimentoLGPD: false, situacao: "emitir", pagoEm: "" });
  const [cob, setCob] = useState<any>(null);
  const [savingM, setSavingM] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [novoId, setNovoId] = useState("");
  const [copiado, setCopiado] = useState("");
  const [fichaId, setFichaId] = useState("");
  const [ficha, setFicha] = useState<any>(null);
  const [fichaLoad, setFichaLoad] = useState(false);
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
  async function criarMembership() {
    if (!nm.nome.trim() || !nm.vencimento || (!nm.valor && !nm.planoId)) { setMsg("Preencha nome, valor (ou plano) e 1º vencimento."); return; }
    setSavingM(true); setCob(null); setNovoId("");
    const r = await fetch("/api/finance/memberships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, paciente: { nome: nm.nome, documento: nm.documento, email: nm.email, telefone: nm.telefone, cep: nm.cep, logradouro: nm.logradouro, numero: nm.numero, bairro: nm.bairro, cidade: nm.cidade, uf: nm.uf, consentimentoLGPD: nm.consentimentoLGPD }, planoId: nm.planoId || null, valor: nm.valor ? Number(nm.valor) : null, recorrencia: nm.recorrencia, diaCobranca: nm.diaCobranca, vencimento: nm.vencimento, situacao: nm.situacao, pagoEm: nm.pagoEm }) });
    const d = await r.json(); setSavingM(false);
    if (!r.ok) { setMsg(d.error || "Erro ao cadastrar."); return; }
    setMsg(d.warning || "✓ Membership criado, conta a receber gerada e cobrança emitida no Inter.");
    setCob(d.cobranca || null);
    setNovoId(d.clienteId || "");
    setNm({ nome: "", documento: "", email: "", telefone: "", cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", planoId: "", valor: "", recorrencia: "mensal", diaCobranca: "", vencimento: "", consentimentoLGPD: false, situacao: "emitir", pagoEm: "" });
    setEtapa(1);
    load();
  }
  async function addLink() { if (!nl.planoId) return; await fetch("/api/finance/onboarding-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...nl }) }); setNl({ planoId: "", valor: "", diaCobranca: "", label: "" }); load(); }
  async function delLink(id: string) { if (!confirm("Desativar este link?")) return; await fetch(`/api/finance/onboarding-links?id=${id}`, { method: "DELETE" }); load(); }
  function linkUrl(token: string) { return `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro/${token}`; }
  async function copiar(token: string) { try { await navigator.clipboard.writeText(linkUrl(token)); setCopiado(token); setTimeout(() => setCopiado(""), 1500); } catch { /* */ } }
  async function gerarMes() { setMsg("Gerando…"); const r = await fetch("/api/finance/receber/gerar-mes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) }); const d = await r.json(); setMsg(r.ok ? `Gerados ${d.criados} títulos do mês (${d.pulados} já existiam/sem vencimento).` : (d.error || "Erro.")); }

  async function abrirFicha(id: string) {
    setFichaId(id); setFicha(null); setFichaLoad(true);
    try { const d = await fetch(`/api/finance/clientes/${id}`).then((r) => r.json()); setFicha(d); } catch { setFicha({ error: "Erro ao carregar." }); }
    setFichaLoad(false);
  }
  if (!isAdmin) return <p style={{ color: "var(--txt-faint)" }}>Apenas administradores gerenciam memberships.</p>;
  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 16, maxWidth: 720 }}><b>Gestão de memberships.</b> Cadastre o paciente abaixo (valor, recorrência, vencimento) e a Sandra cria o cadastro, a assinatura, a conta a receber e emite a cobrança. No início de cada mês, "Gerar títulos do mês" cria os recebíveis das assinaturas ativas.</div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14, maxWidth: 640 }}>{msg}</div>}
      <button className="fx-btn fx-btn-primary" onClick={gerarMes} style={{ marginBottom: 18 }}>Gerar títulos do mês</button>

      <Section title="Novo membership (paciente + cobrança)">
        <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 12, maxWidth: 720 }}>Em 3 passos: paciente, endereço e cobrança. A Sandra cria o cadastro, a assinatura, a conta a receber e <b>emite o Pix/boleto no Inter</b> (CPF + endereço são necessários pro boleto).</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {([[1, "Paciente"], [2, "Endereço"], [3, "Cobrança"]] as const).map(([n, l]) => (
            <button key={n} type="button" onClick={() => setEtapa(n)} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: etapa === n ? "var(--roxo)" : "var(--line)", color: etapa === n ? "#fff" : "var(--txt-soft)" }}>{n}</span>
              <span style={{ fontSize: 13, fontWeight: etapa === n ? 700 : 500, color: etapa >= n ? "var(--txt)" : "var(--txt-faint)" }}>{l}</span>
            </button>
          ))}
        </div>

        {etapa === 1 && (
          <>
            <Row>
              <Field label="Nome do paciente *"><input className="fx-input" value={nm.nome} onChange={(e) => setNm({ ...nm, nome: e.target.value })} /></Field>
              <Field label="CPF"><input className="fx-input" value={nm.documento} onChange={(e) => setNm({ ...nm, documento: e.target.value })} placeholder="000.000.000-00" /></Field>
            </Row>
            <Row>
              <Field label="E-mail"><input className="fx-input" value={nm.email} onChange={(e) => setNm({ ...nm, email: e.target.value })} /></Field>
              <Field label="Telefone"><input className="fx-input" value={nm.telefone} onChange={(e) => setNm({ ...nm, telefone: e.target.value })} /></Field>
            </Row>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button className="fx-btn fx-btn-primary" onClick={() => { if (!nm.nome.trim()) { setMsg("Informe o nome do paciente."); return; } setMsg(""); setEtapa(2); }}>Próximo →</button>
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <Row>
              <Field label="CEP"><input className="fx-input" value={nm.cep} onChange={(e) => setNm({ ...nm, cep: e.target.value })} /></Field>
              <Field label="Endereço"><input className="fx-input" value={nm.logradouro} onChange={(e) => setNm({ ...nm, logradouro: e.target.value })} /></Field>
              <Field label="Nº"><input className="fx-input" value={nm.numero} onChange={(e) => setNm({ ...nm, numero: e.target.value })} /></Field>
            </Row>
            <Row>
              <Field label="Bairro"><input className="fx-input" value={nm.bairro} onChange={(e) => setNm({ ...nm, bairro: e.target.value })} /></Field>
              <Field label="Cidade"><input className="fx-input" value={nm.cidade} onChange={(e) => setNm({ ...nm, cidade: e.target.value })} /></Field>
              <Field label="UF"><input className="fx-input" value={nm.uf} maxLength={2} onChange={(e) => setNm({ ...nm, uf: e.target.value.toUpperCase() })} /></Field>
            </Row>
            <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 2 }}>Sem CPF/endereço dá pra cadastrar mesmo assim — o boleto fica pra emitir depois.</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <button className="fx-btn" onClick={() => setEtapa(1)}>← Voltar</button>
              <button className="fx-btn fx-btn-primary" onClick={() => setEtapa(3)}>Próximo →</button>
            </div>
          </>
        )}

        {etapa === 3 && (
          <>
            <Row>
              <Field label="Plano (opcional)"><select className="fx-input" value={nm.planoId} onChange={(e) => setNm({ ...nm, planoId: e.target.value })}><option value="">— valor avulso —</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({money(p.valor)})</option>)}</select></Field>
              <Field label="Valor (R$)"><input className="fx-input" type="number" value={nm.valor} onChange={(e) => setNm({ ...nm, valor: e.target.value })} placeholder={nm.planoId ? "usa o do plano" : "ex.: 500"} /></Field>
            </Row>
            <Row>
              <Field label="Recorrência"><select className="fx-input" value={nm.recorrencia} onChange={(e) => setNm({ ...nm, recorrencia: e.target.value })}><option value="mensal">Mensal (assinatura)</option><option value="unica">Única (1 cobrança)</option></select></Field>
              <Field label="1º vencimento *"><input className="fx-input" type="date" value={nm.vencimento} onChange={(e) => setNm({ ...nm, vencimento: e.target.value })} /></Field>
              <Field label="Dia de cobrança"><input className="fx-input" type="number" value={nm.diaCobranca} onChange={(e) => setNm({ ...nm, diaCobranca: e.target.value })} placeholder="ex.: 5" /></Field>
            </Row>
            <Row>
              <Field label="Situação do 1º pagamento"><select className="fx-input" value={nm.situacao} onChange={(e) => setNm({ ...nm, situacao: e.target.value })}><option value="emitir">Emitir cobrança agora (Inter)</option><option value="pago">Já foi pago (só registrar)</option><option value="registrar">Em aberto (só registrar, sem emitir)</option></select></Field>
              {nm.situacao === "pago" && <Field label="Pago em"><input className="fx-input" type="date" value={nm.pagoEm} onChange={(e) => setNm({ ...nm, pagoEm: e.target.value })} /></Field>}
            </Row>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--txt-soft)", margin: "6px 0 12px" }}><input type="checkbox" checked={nm.consentimentoLGPD} onChange={(e) => setNm({ ...nm, consentimentoLGPD: e.target.checked })} /> Consentimento LGPD registrado (execução de contrato)</label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="fx-btn" onClick={() => setEtapa(2)}>← Voltar</button>
              <button className="fx-btn fx-btn-primary" disabled={savingM} onClick={criarMembership}>{savingM ? "Cadastrando…" : nm.situacao === "emitir" ? "Cadastrar e emitir cobrança" : "Cadastrar membership"}</button>
            </div>
          </>
        )}
        {novoId && (
          <div style={{ marginTop: 14, border: "1px solid #9fe1cb", background: "var(--verde-soft)", borderRadius: "var(--r-card)", padding: "14px 16px", maxWidth: 660 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0c5a44" }}>✓ Paciente cadastrado</div>
              <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => { setNovoId(""); setCob(null); }}>fechar</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
              <button className="fx-btn fx-btn-primary" onClick={() => window.open(`/api/finance/clientes/${novoId}/contrato`, "_blank")}>Gerar contrato</button>
              <span style={{ fontSize: 12, color: "#0c5a44", alignSelf: "center" }}>→ mande assinar (gov.br) e suba o assinado no Cofre do paciente (na lista de Clientes).</span>
            </div>
            {cob && (
              <div style={{ borderTop: "1px solid #9fe1cb", paddingTop: 10, marginTop: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#0c5a44" }}>Cobrança emitida — envie pro paciente:</div>
                {cob.secureUrl && <div style={{ fontSize: 13, marginBottom: 4 }}>Boleto/PDF: <a href={cob.secureUrl} target="_blank" rel="noreferrer" style={{ color: "var(--roxo)" }}>abrir</a></div>}
                {cob.linhaDigitavel && <div style={{ fontSize: 12, color: "var(--txt-soft)", marginBottom: 4 }}>Linha digitável: {cob.linhaDigitavel}</div>}
                {cob.pixCopiaECola && <div style={{ fontSize: 12, color: "var(--txt-soft)", wordBreak: "break-all" }}>Pix copia-e-cola: {cob.pixCopiaECola}</div>}
              </div>
            )}
          </div>
        )}
      </Section>

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
            <div onClick={() => abrirFicha(c.id)} title="Abrir ficha do paciente" style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-soft, rgba(146,80,172,.05))"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--roxo)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)"; }}>
              <span style={{ color: "var(--roxo)", fontSize: 15, flexShrink: 0 }}>👤</span>
              <div style={{ flex: 1, minWidth: 0 }}><b>{c.nome}</b>{c.documento ? <span style={{ fontSize: 12, color: "var(--txt-faint)" }}> · {c.documento}</span> : null}<div style={{ fontSize: 11.5, color: "var(--roxo)", fontWeight: 600 }}>Ver ficha (plano, pagamentos, recebíveis) →</div></div>
              <button className="fx-btn" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); abrirDocs(c.id); }}>Documentos</button>
              <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={`/api/finance/clientes/${c.id}/contrato`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>Gerar contrato</a>
              <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={`/api/finance/clientes/${c.id}/recibo`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>Recibo (reembolso)</a>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={(e) => { e.stopPropagation(); delCliente(c.id); }}>Excluir</button>
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
              {a.clienteId && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => window.open(`/api/finance/clientes/${a.clienteId}/contrato`, "_blank")}>Contrato</button>}
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

      {fichaId && (
        <div onClick={() => setFichaId("")} style={{ position: "fixed", inset: 0, background: "rgba(20,12,30,.45)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "5vh 16px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "var(--r-card)", width: "100%", maxWidth: 720, boxShadow: "0 20px 60px rgba(0,0,0,.3)", padding: 0, overflow: "hidden" }}>
            {fichaLoad && <div style={{ padding: 28, color: "var(--txt-faint)" }}>Carregando ficha…</div>}
            {!fichaLoad && ficha?.error && <div style={{ padding: 28, color: "var(--coral-deep)" }}>{ficha.error}</div>}
            {!fichaLoad && ficha?.cliente && (() => {
              const cl = ficha.cliente, re = ficha.resumo, as = ficha.assinatura, q = ficha.qualificacao;
              const dt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
              const stCor: Record<string, string> = { paga: "#0f6b50", pendente: "#b5651d", vencida: "#c0392b", cancelada: "#9a8f84", estornada: "#9a8f84" };
              const card = (label: string, valor: string, cor?: string) => (
                <div style={{ flex: 1, minWidth: 130, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: cor || "var(--txt)", marginTop: 2 }}>{valor}</div>
                </div>
              );
              return (
                <div>
                  <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 19, fontWeight: 700 }}>{cl.nome} {!cl.ativo && <span style={{ fontSize: 11, color: "var(--coral-deep)", fontWeight: 600 }}>· inativo</span>}</div>
                      <div style={{ fontSize: 12.5, color: "var(--txt-faint)", marginTop: 3 }}>
                        {cl.documento ? `CPF/CNPJ ${cl.documento}` : "sem CPF"}{cl.rg ? ` · RG ${cl.rg}` : ""} · cliente desde {dt(re.desdeCliente)}
                      </div>
                    </div>
                    <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => setFichaId("")}>fechar</button>
                  </div>
                  <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {card("MRR", "R$ " + (re.mrr || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))}
                      {card("Em aberto", `R$ ${(re.emAbertoValor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, re.emAbertoValor > 0 ? "#b5651d" : undefined)}
                      {card("Vencido", `R$ ${(re.vencidoValor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` + (re.vencidoCount ? ` (${re.vencidoCount})` : ""), re.vencidoValor > 0 ? "#c0392b" : undefined)}
                      {card("Pago (total)", `R$ ${(re.pagoTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "#0f6b50")}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Assinatura / Plano</div>
                      {as ? (
                        <div style={{ fontSize: 13.5 }}>{as.plano} · <b>R$ {(as.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</b> · desde {dt(as.desde)} · próxima cobrança {dt(as.proximaCobranca)}{as.diaCobranca ? ` · dia ${as.diaCobranca}` : ""}</div>
                      ) : <div style={{ fontSize: 13, color: "var(--txt-faint)" }}>Sem assinatura ativa.</div>}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Qualificação (engajamento)</div>
                      <div style={{ fontSize: 13.5 }}>{q.taxaPresenca === null ? "Sem sessões marcadas ainda." : <>Presença: <b>{q.taxaPresenca}%</b> · {q.presentes} de {q.marcadas} sessões · último pagamento {dt(re.ultimoPagamento)}</>}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Recebíveis ({ficha.recebiveis.length})</div>
                      {ficha.recebiveis.length === 0 ? <div style={{ fontSize: 13, color: "var(--txt-faint)" }}>Nenhuma conta a receber lançada.</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {ficha.recebiveis.map((r: any) => (
                            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: stCor[r.status] || "#9a8f84" }} />
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descricao || "Conta a receber"}</span>
                              <span style={{ color: "var(--txt-faint)", fontSize: 12 }}>{r.status === "paga" ? "pago " + dt(r.pagoEm) : "vence " + dt(r.vencimento)}</span>
                              <b style={{ minWidth: 90, textAlign: "right" }}>R$ {(r.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
                              {r.secureUrl && <a href={r.secureUrl} target="_blank" rel="noreferrer" className="fx-btn" style={{ fontSize: 11 }}>cobrança</a>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                      <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={`/api/finance/clientes/${cl.id}/contrato`} target="_blank" rel="noopener">Gerar contrato</a>
                      <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={`/api/finance/clientes/${cl.id}/recibo`} target="_blank" rel="noopener">Recibo (reembolso)</a>
                      <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => { setFichaId(""); abrirDocs(cl.id); }}>Documentos ({ficha.documentos.length})</button>
                      <span style={{ fontSize: 11.5, color: "var(--txt-faint)", alignSelf: "center" }}>{cl.consentimentoLGPD ? "LGPD: consentimento registrado" : "LGPD: sem consentimento"}{cl.email ? ` · ${cl.email}` : ""}{cl.telefone ? ` · ${cl.telefone}` : ""}</span>
                    </div>
                    {cl.endereco && <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{cl.endereco}</div>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Cobrança (gateway: boleto/PIX/cartão) ---------- */
