"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Row, Field, TabHeader } from "./ui";

export function ContasTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [contas, setContas] = useState<{ id: string; nome: string; banco: string | null; conexao: string; tipo?: string; _count: { transacoes: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ nome: "", banco: "c6", tipo: "caixa" });
  const [msg, setMsg] = useState("");
  const [lancarEm, setLancarEm] = useState<string | null>(null);
  const [lanc, setLanc] = useState({ data: new Date().toISOString().slice(0, 10), tipo: "debito", valor: "", descricao: "" });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/contas?company=${companyId}`).then((r) => r.json()).then((d) => setContas(d.contas || [])).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!novo.nome.trim()) return;
    await fetch("/api/finance/contas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, nome: novo.nome, banco: novo.banco, tipo: novo.tipo, conexao: "manual" }) });
    setNovo({ nome: "", banco: "c6", tipo: "caixa" }); load();
  }
  async function importar(id: string, file: File) {
    setMsg("Importando…");
    const csv = await file.text();
    const r = await fetch(`/api/finance/contas/${id}/importar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
    const d = await r.json();
    setMsg(r.ok ? `Importado: ${d.criados} lançamentos (${d.pulados} pulados/duplicados).` : (d.error || "Erro ao importar."));
    load();
  }
  async function lancarManual(id: string) {
    const r = await fetch(`/api/finance/contas/${id}/lancar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lanc) });
    const d = await r.json();
    if (!r.ok) { setMsg(d.error || "Erro ao lançar."); return; }
    setMsg("Lançamento registrado.");
    setLancarEm(null); setLanc({ data: new Date().toISOString().slice(0, 10), tipo: "debito", valor: "", descricao: "" }); load();
  }
  const TIPO: Record<string, { l: string; c: string; bg: string }> = {
    caixa: { l: "caixa", c: "#0f6b50", bg: "var(--verde-soft, #d7ebe2)" },
    cartao: { l: "cartão", c: "#7a3fa0", bg: "rgba(146,80,172,.12)" },
    socio: { l: "sócio (PF)", c: "#274b6d", bg: "#dce8f2" },
  };

  return (
    <>
      <TabHeader title="Contas bancárias" subtitle="O caixa soma as contas de tipo caixa. Cartão e sócio (PF) entram na DRE, mas ficam fora do Fluxo. Inter é ao vivo; as demais você importa CSV ou lança manual." />
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14, maxWidth: 640 }}>{msg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50", flexShrink: 0 }} />
          <div style={{ flex: 1 }}><b>Inter PJ</b> <span className="pill" style={{ background: "var(--verde-soft)", color: "var(--verde)", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px", marginLeft: 6 }}>conectada (API)</span><div style={{ fontSize: 12, color: "var(--txt-faint)" }}>Extrato ao vivo · conciliação automática</div></div>
        </div>
        {contas.map((c) => {
          const t = TIPO[c.tipo || "caixa"] || TIPO.caixa;
          const aberto = lancarEm === c.id;
          return (
            <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.c, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <b>{c.nome}</b>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.c, background: t.bg, borderRadius: 999, padding: "2px 9px", marginLeft: 6 }}>{t.l}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#b5781f", background: "var(--amarelo)", borderRadius: 999, padding: "2px 9px", marginLeft: 6 }}>manual</span>
                  <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{c._count.transacoes} lançamentos</div>
                </div>
                {isAdmin && <button className="fx-btn" style={{ fontSize: 12.5 }} onClick={() => setLancarEm(aberto ? null : c.id)}>{aberto ? "Fechar" : "Lançar"}</button>}
                <input ref={(el) => { fileRefs.current[c.id] = el; }} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(c.id, f); e.currentTarget.value = ""; }} />
                <button className="fx-btn" style={{ fontSize: 12.5 }} onClick={() => fileRefs.current[c.id]?.click()}>Importar CSV</button>
              </div>
              {aberto && (
                <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg, #faf8fb)", padding: "12px 15px" }}>
                  <Row>
                    <Field label="Data"><input className="fx-input" type="date" value={lanc.data} onChange={(e) => setLanc({ ...lanc, data: e.target.value })} /></Field>
                    <Field label="Tipo"><select className="fx-input" value={lanc.tipo} onChange={(e) => setLanc({ ...lanc, tipo: e.target.value })}><option value="debito">Saída (despesa)</option><option value="credito">Entrada</option></select></Field>
                    <Field label="Valor (R$)"><input className="fx-input" inputMode="decimal" value={lanc.valor} onChange={(e) => setLanc({ ...lanc, valor: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="2000,00" /></Field>
                  </Row>
                  <Field label="Descrição (use o nome do fornecedor p/ classificar)"><input className="fx-input" value={lanc.descricao} onChange={(e) => setLanc({ ...lanc, descricao: e.target.value })} placeholder="ex.: MILENA - atendimento psicológico" /></Field>
                  <button className="fx-btn fx-btn-primary" disabled={!lanc.valor || !lanc.descricao.trim()} onClick={() => lancarManual(c.id)}>Registrar lançamento</button>
                </div>
              )}
            </div>
          );
        })}
        {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      </div>

      {isAdmin && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 560 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>+ Adicionar conta (manual)</div>
          <Row>
            <Field label="Nome"><input className="fx-input" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="ex.: PF — Giancarlo (sócio)" /></Field>
            <Field label="Banco"><select className="fx-input" value={novo.banco} onChange={(e) => setNovo({ ...novo, banco: e.target.value })}><option value="c6">C6</option><option value="nubank">Nubank</option><option value="bradesco">Bradesco</option><option value="itau">Itaú</option><option value="outro">Outro</option></select></Field>
            <Field label="Tipo"><select className="fx-input" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}><option value="caixa">Caixa (entra no fluxo)</option><option value="cartao">Cartão (fora do fluxo)</option><option value="socio">Sócio PF (fora do fluxo)</option></select></Field>
          </Row>
          <button className="fx-btn fx-btn-primary" disabled={!novo.nome.trim()} onClick={add}>Adicionar</button>
        </div>
      )}
    </>
  );
}

/* ---------- DRE (regime de competência) ---------- */
