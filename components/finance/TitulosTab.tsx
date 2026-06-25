"use client";
import { useState, useEffect, useCallback } from "react";
import { Row, Field } from "./ui";

export function TitulosTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  type Tit = { id: string; descricao: string; valor: number; status: string; metodo: string | null; vencimento: string | null; pagoEm: string | null; origem: string; provider: string; cliente: string | null; recorrente: boolean };
  const [list, setList] = useState<Tit[]>([]);
  const [resumo, setResumo] = useState({ aReceber: 0, vencido: 0, recebidoMes: 0 });
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ descricao: "", valor: "", vencimento: "", clienteId: "", metodo: "" });
  const [open, setOpen] = useState(false);
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/receber?company=${companyId}`).then((r) => r.json()).then((d) => { setList(d.recebiveis || []); setResumo(d.resumo || { aReceber: 0, vencido: 0, recebidoMes: 0 }); }).finally(() => setLoading(false));
    fetch(`/api/finance/clientes?company=${companyId}`).then((r) => r.json()).then((d) => setClientes(d.clientes || []));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function lancar() {
    if (!form.descricao.trim() || !Number(form.valor)) return;
    await fetch("/api/finance/receber", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...form, valor: Number(form.valor) }) });
    setForm({ descricao: "", valor: "", vencimento: "", clienteId: "", metodo: "" }); setOpen(false); load();
  }
  async function acao(id: string, action: string) {
    if (action === "delete") { if (!confirm("Excluir este título?")) return; await fetch(`/api/finance/receber/${id}`, { method: "DELETE" }); }
    else await fetch(`/api/finance/receber/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  }
  const tone = (s: string) => s === "paga" ? { bg: "#d7ebe2", fg: "#0f6b50", l: "Recebido" } : s === "vencida" ? { bg: "#f3dcd8", fg: "#a8332c", l: "Vencido" } : s === "cancelada" ? { bg: "var(--line)", fg: "var(--txt-faint)", l: "Cancelado" } : { bg: "#f6e7cd", fg: "#b5781f", l: "A receber" };
  const shown = filtro ? list.filter((r) => r.status === filtro) : list;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {([["A receber", resumo.aReceber, "#b5781f"], ["Vencido", resumo.vencido, "#a8332c"], ["Recebido no mês", resumo.recebidoMes, "#0f6b50"]] as const).map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, minWidth: 150, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{money(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <select className="fx-input" style={{ maxWidth: 180 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos os status</option><option value="pendente">A receber</option><option value="vencida">Vencidos</option><option value="paga">Recebidos</option><option value="cancelada">Cancelados</option>
        </select>
        {isAdmin && <button className="fx-btn fx-btn-primary" onClick={() => setOpen(!open)}>{open ? "Fechar" : "+ Lançar título"}</button>}
      </div>

      {open && isAdmin && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, marginBottom: 16, maxWidth: 760 }}>
          <Row><Field label="Descrição*"><input className="fx-input" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="ex.: Sessão avulsa — João" /></Field>
            <Field label="Valor (R$)*"><input className="fx-input" type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field></Row>
          <Row><Field label="Vencimento"><input className="fx-input" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
            <Field label="Cliente"><select className="fx-input" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}><option value="">— opcional —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
            <Field label="Método"><select className="fx-input" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}><option value="">—</option><option value="pix">Pix</option><option value="bank_slip">Boleto</option><option value="credit_card">Cartão</option></select></Field></Row>
          <button className="fx-btn fx-btn-primary" disabled={!form.descricao.trim() || !Number(form.valor)} onClick={lancar}>Lançar</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
        {!loading && shown.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum título. Lance um avulso ou gere os das memberships na aba Memberships.</p>}
        {shown.map((r) => { const t = tone(r.status); return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.descricao} {r.recorrente && <span style={{ fontSize: 10, fontWeight: 700, color: "#7a4fb0", background: "rgba(146,80,172,.12)", borderRadius: 999, padding: "1px 7px" }}>membership</span>}</div>
              <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{r.cliente ? r.cliente + " · " : ""}{r.vencimento ? "vence " + new Date(r.vencimento).toLocaleDateString("pt-BR") : "sem vencimento"}{r.pagoEm ? " · recebido " + new Date(r.pagoEm).toLocaleDateString("pt-BR") : ""}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{money(r.valor)}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: "2px 10px" }}>{t.l}</span>
            {isAdmin && r.status !== "paga" && r.status !== "cancelada" && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => acao(r.id, "receber")}>Receber</button>}
            {isAdmin && r.status === "paga" && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => acao(r.id, "reabrir")}>Reabrir</button>}
            {isAdmin && r.provider === "manual" && r.status !== "paga" && <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => acao(r.id, "delete")}>Excluir</button>}
          </div>
        ); })}
      </div>
      <p style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 14, maxWidth: 700 }}>“Receber” marca o título como recebido. A conciliação automática com a entrada no extrato entra junto da tela de Conciliação.</p>
    </>
  );
}

/* ---------- Memberships (planos + assinaturas) ---------- */
