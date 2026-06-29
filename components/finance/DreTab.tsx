"use client";
import { useState, useEffect } from "react";
import { Section } from "./ui";
import React from "react";

export function DreTab({ companyId, regime = "competencia" }: { companyId: string; regime?: string }) {
  const caixa = regime === "caixa";
  type Item = { data: string; descricao: string; valor: number };
  type Cat = { grupo: string; nome: string; total: number; porMes: Record<string, number>; itens: Item[] };
  type Grp = { total: number; porMes: Record<string, number>; categorias: Cat[] };
  type Dados = { regime: string; meses: string[]; receitas: Grp; despesasOperacional: Grp; resultadoOperacional: { total: number; porMes: Record<string, number> }; naoOperacional: { investimento: Cat[]; financiamento: Cat[] } };
  const [d, setD] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { setLoading(true); fetch(`/api/finance/dre?company=${companyId}${caixa ? "&regime=caixa" : ""}`).then((r) => r.json()).then(setD).finally(() => setLoading(false)); }, [companyId]);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mesLabel = (m: string) => { const [a, mm] = m.split("-"); return `${mm}/${a.slice(2)}`; };
  if (loading) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;
  if (!d || !d.meses) return <p style={{ color: "var(--txt-faint)" }}>Sem dados.</p>;
  const meses = d.meses;
  const cell: React.CSSProperties = { padding: "6px 10px", textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap" };
  const head: React.CSSProperties = { ...cell, fontWeight: 700, color: "var(--txt-soft)", borderBottom: "1px solid var(--line)" };

  const totalRow = (nome: string, porMes: Record<string, number>, total: number, color?: string) => (
    <tr style={{ background: "var(--surface)" }}>
      <td style={{ padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color }}>{nome}</td>
      {meses.map((m) => <td key={m} style={{ ...cell, fontWeight: 700, color }}>{porMes[m] ? money(porMes[m]) : "—"}</td>)}
      <td style={{ ...cell, fontWeight: 700, color }}>{money(total)}</td>
    </tr>
  );
  const catRows = (cats: Cat[], color?: string) => cats.flatMap((c) => {
    const key = `${c.grupo}|${c.nome}`; const isOpen = open[key];
    const rows = [
      <tr key={key} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} style={{ cursor: "pointer" }}>
        <td style={{ padding: "6px 10px 6px 22px", fontSize: 12.5 }}><span style={{ color: "var(--txt-faint)", marginRight: 5 }}>{isOpen ? "▾" : "▸"}</span>{c.grupo} › {c.nome} <span style={{ fontSize: 10.5, color: "var(--txt-faint)" }}>({c.itens.length})</span></td>
        {meses.map((m) => <td key={m} style={{ ...cell, color }}>{c.porMes[m] ? money(c.porMes[m]) : "—"}</td>)}
        <td style={{ ...cell, fontWeight: 600, color }}>{money(c.total)}</td>
      </tr>,
    ];
    if (isOpen) rows.push(
      <tr key={key + "-d"}><td colSpan={meses.length + 2} style={{ padding: 0 }}>
        <div style={{ background: "var(--bg-soft, rgba(0,0,0,.02))", padding: "6px 10px 8px 38px" }}>
          {c.itens.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.8, color: "var(--txt-soft)", padding: "2px 0", borderBottom: "1px dashed var(--line)" }}>
              <span>{new Date(it.data).toLocaleDateString("pt-BR")} · {it.descricao}</span><span style={{ fontWeight: 600 }}>{money(it.valor)}</span>
            </div>
          ))}
        </div>
      </td></tr>
    );
    return rows;
  });

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 780 }}><b>{caixa ? "Demonstrativo de Caixa" : "DRE"} — {d.regime}.</b> {caixa ? "Tudo que entrou e saiu das contas de caixa, na data do pagamento, agrupado por categoria." : "Lê os lançamentos reais (extrato + cartão + recebíveis)."} <b>Clique numa categoria</b> para ver os lançamentos.</div>
      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-card)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 540 }}>
          <thead><tr><th style={{ ...head, textAlign: "left" }}>Conta</th>{meses.map((m) => <th key={m} style={head}>{mesLabel(m)}</th>)}<th style={head}>Total</th></tr></thead>
          <tbody>
            {totalRow(caixa ? "ENTRADAS" : "RECEITAS", d.receitas.porMes, d.receitas.total, "#0f6b50")}
            {catRows(d.receitas.categorias)}
            {d.receitas.categorias.length === 0 && <tr><td colSpan={meses.length + 2} style={{ padding: "6px 22px", fontSize: 12, color: "var(--txt-faint)" }}>Sem receitas no período.</td></tr>}
            {totalRow(caixa ? "(−) SAÍDAS" : "(−) DESPESAS OPERACIONAIS", d.despesasOperacional.porMes, d.despesasOperacional.total, "#a8332c")}
            {catRows(d.despesasOperacional.categorias)}
            {totalRow(caixa ? "= VARIAÇÃO DE CAIXA" : "= RESULTADO OPERACIONAL", d.resultadoOperacional.porMes, d.resultadoOperacional.total)}
          </tbody>
        </table>
      </div>
      {(d.naoOperacional.investimento.length > 0 || d.naoOperacional.financiamento.length > 0) && (
        <Section title="Memo — fora do resultado (vão pro Balanço)">
          {[...d.naoOperacional.investimento.map((c) => ["Investimento", c] as const), ...d.naoOperacional.financiamento.map((c) => ["Financiamento", c] as const)].map(([b, c], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: "var(--txt-soft)" }}><span>{b} · {c.grupo} › {c.nome}</span><b>{money(c.total)}</b></div>
          ))}
        </Section>
      )}
    </>
  );
}
