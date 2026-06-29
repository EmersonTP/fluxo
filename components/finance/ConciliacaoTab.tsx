"use client";
import { useState, useEffect, useCallback } from "react";

export function ConciliacaoTab({ companyId }: { companyId: string }) {
  type Sug = { tipo: string; id: string; descricao: string; valor: number; status: string };
  type Lanc = { id: string; data: string; descricao: string; valor: number; tipo: string; conta: string; conciliado: boolean; requestId: string | null; sugestoes: Sug[] };
  const [data, setData] = useState<{ pendentes: number; total: number; lancamentos: Lanc[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [soPend, setSoPend] = useState(true);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/conciliar?company=${companyId}${soPend ? "&pendentes=1" : ""}`).then((r) => r.json()).then(setData).finally(() => setLoading(false)); }, [companyId, soPend]);
  useEffect(() => { load(); }, [load]);
  async function act(transactionId: string, body: any) { await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId, ...body }) }); load(); }
  const [autoMsg, setAutoMsg] = useState("");
  async function autoConc() {
    if (!confirm("Conciliar automaticamente os lançamentos que seguem padrões (transferências, CDB/aplicação, fatura, tarifas) e os que casam por valor único?")) return;
    setAutoMsg("Conciliando…");
    const r = await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "auto", companyId }) });
    const d = await r.json();
    setAutoMsg(r.ok ? `${d.auto} conciliado(s) automaticamente · ${d.restantes} restante(s) pra revisar.` : (d.error || "Erro."));
    load();
  }
  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 12, maxWidth: 760 }}><b>Conciliação.</b> Cada lançamento do extrato é amarrado ao pagamento/recebimento que o originou. A Sandra sugere o que casa pelo valor; você confirma. (Cartão fica de fora — não é caixa.)</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: "var(--txt-soft)", display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={soPend} onChange={(e) => setSoPend(e.target.checked)} /> Só pendentes</label>
        {data && <span style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>{data.pendentes} pendente(s) de {data.total}</span>}
        <button className="fx-btn fx-btn-primary" onClick={autoConc} style={{ marginLeft: "auto" }}>Conciliar automático</button>
        <button className="fx-btn" onClick={load}>Recarregar</button>
      </div>
      {autoMsg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "8px 12px", fontSize: 12.5, marginBottom: 12 }}>{autoMsg}</div>}
      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data && data.lancamentos.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nada para conciliar no período. 🎉</p>}
        {data && data.lancamentos.map((l) => (
          <div key={l.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "11px 14px", background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{new Date(l.data).toLocaleDateString("pt-BR")} · {l.conta}</div>
              </div>
              <div style={{ fontWeight: 700, color: l.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{l.tipo === "credito" ? "+" : "−"}{money(l.valor)}</div>
              {l.conciliado
                ? <><span style={{ fontSize: 11, fontWeight: 700, color: "#0f6b50", background: "#d7ebe2", borderRadius: 999, padding: "2px 9px" }}>✓ conciliado</span><button className="fx-btn" style={{ fontSize: 11.5 }} onClick={() => act(l.id, { action: "desconciliar" })}>Desfazer</button></>
                : <button className="fx-btn" style={{ fontSize: 11.5 }} onClick={() => act(l.id, { conciliado: true })}>Marcar conciliado</button>}
            </div>
            {!l.conciliado && l.sugestoes.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 11.5, color: "var(--txt-faint)", alignSelf: "center" }}>Casa com:</span>
                {l.sugestoes.map((sg) => (
                  <button key={sg.id} className="fx-btn" style={{ fontSize: 11.5 }} onClick={() => act(l.id, { requestId: sg.id, conciliado: true })}>{sg.tipo === "pagar" ? "Pagar" : "Receber"}: {sg.descricao?.slice(0, 30)} ({money(sg.valor)})</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Cabeçalho padrão de aba (consistência visual) ---------- */


/* ---------- Visão geral (home do financeiro) ---------- */
