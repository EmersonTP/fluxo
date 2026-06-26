"use client";
import { useState, useEffect, useCallback } from "react";
import { TabHeader } from "./ui";

export function BalancoTab({ companyId }: { companyId: string }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/balanco?company=${companyId}`).then((r) => r.json()).then(setD).finally(() => setLoading(false)); }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR");

  const Linha = ({ label, valor, forte, recuo }: { label: string; valor: number; forte?: boolean; recuo?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: forte ? "8px 0" : "4px 0", borderTop: forte ? "1px solid var(--line)" : "none", fontWeight: forte ? 700 : 400, fontSize: forte ? 14 : 13, paddingLeft: recuo ? 14 : 0 }}>
      <span style={{ color: forte ? "var(--txt)" : "var(--txt-soft)" }}>{label}</span>
      <span style={{ color: valor < 0 ? "#a8332c" : forte ? "var(--txt)" : "var(--txt-soft)" }}>{money(valor)}</span>
    </div>
  );
  const Bloco = ({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) => (
    <div style={{ flex: 1, minWidth: 280, border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "14px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: cor, marginBottom: 8, borderLeft: `3px solid ${cor}`, paddingLeft: 10 }}>{titulo}</div>
      {children}
    </div>
  );

  return (
    <>
      <TabHeader title="Balanço gerencial" subtitle="Ativo = Passivo + Patrimônio Líquido. Derivado dos lançamentos — visão de gestão, não substitui o balanço oficial do contador." right={<button className="fx-btn" onClick={load} disabled={loading}>{loading ? "…" : "Recarregar"}</button>} />
      {loading && !d && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {d && (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-start" }}>
            <Bloco titulo="Ativo" cor="#274b6d">
              <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginBottom: 2 }}>Circulante</div>
              <Linha label="Caixa e bancos" valor={d.ativo.circulante.caixa} recuo />
              <Linha label="Aplicações (CDB)" valor={d.ativo.circulante.aplicacoesCDB} recuo />
              <Linha label="Contas a receber" valor={d.ativo.circulante.contasAReceber} recuo />
              <div style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "8px 0 2px" }}>Não circulante</div>
              <Linha label="Intangível (dev software)" valor={d.ativo.naoCirculante.intangivelDevSoftware} recuo />
              <Linha label="Total do Ativo" valor={d.ativo.total} forte />
            </Bloco>
            <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>
              <Bloco titulo="Passivo" cor="#a8332c">
                <Linha label="Contas a pagar" valor={d.passivo.circulante.contasAPagar} recuo />
                <Linha label="Total do Passivo" valor={d.passivo.total} forte />
              </Bloco>
              <Bloco titulo="Patrimônio Líquido" cor="#0f6b50">
                <Linha label="Aportes dos sócios" valor={d.patrimonioLiquido.aportesSocios} recuo />
                <Linha label="Resultado acumulado" valor={d.patrimonioLiquido.resultadoAcumulado} recuo />
                <Linha label="Total do PL" valor={d.patrimonioLiquido.total} forte />
              </Bloco>
            </div>
          </div>

          <div style={{ maxWidth: 700, border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: Math.abs(d.conferencia.diferencaAConciliar) < 1 ? "#d7ebe2" : "#f6e7cd", padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Ativo</span><b>{money(d.conferencia.ativo)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Passivo + PL</span><b>{money(d.conferencia.passivoMaisPL)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, borderTop: "1px solid rgba(0,0,0,.12)", marginTop: 4, paddingTop: 4 }}>
              <span>{Math.abs(d.conferencia.diferencaAConciliar) < 1 ? "✓ Fecha" : "Diferença a conciliar"}</span>
              <span>{money(d.conferencia.diferencaAConciliar)}</span>
            </div>
          </div>

          <div style={{ maxWidth: 760, fontSize: 12, color: "var(--txt-faint)" }}>
            {d.notas.map((n: string, i: number) => <div key={i} style={{ marginBottom: 3 }}>• {n}</div>)}
          </div>
        </>
      )}
    </>
  );
}
