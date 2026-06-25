"use client";
import { useState, useEffect, useCallback } from "react";
import { Field, Metric } from "./ui";

export function GestaoTab({ companyId }: { companyId: string }) {
  const hoje = new Date();
  const fmtY = (d: Date) => d.toISOString().slice(0, 10);
  const [de, setDe] = useState(fmtY(new Date(2026, 3, 1))); // abril/2026 (início Emerson)
  const [ate, setAte] = useState(fmtY(hoje));
  const [data, setData] = useState<{ totalCredito: number; totalDebito: number; saldoMovimento: number; quantidade: number; lancamentos: { data: string | null; tipo: string; valor: number; titulo: string; descricao: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(() => {
    setLoading(true); setErr(""); setData(null);
    fetch(`/api/finance/inter/extrato?company=${companyId}&de=${de}&ate=${ate}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro ao buscar o extrato."); return d; })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [companyId, de, ate]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 680 }}>
        <b>Extrato bancário</b> — direto do Banco Inter. É a base da conciliação: o que de fato entrou e saiu da conta.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <Field label="De"><input className="fx-input" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
        <Field label="Até"><input className="fx-input" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
        <button className="fx-btn fx-btn-primary" disabled={loading} onClick={load}>{loading ? "Buscando…" : "Atualizar"}</button>
      </div>

      {err && (
        <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "12px 15px", fontSize: 13.5, maxWidth: 680 }}>
          {err}
          {/conectado|conexão|não conectado/i.test(err) && <div style={{ marginTop: 6, color: "var(--txt-soft)" }}>Conecte o Inter em <b>Contas a Receber → Inter</b>.</div>}
        </div>
      )}

      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando extrato…</p>}

      {data && !loading && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <Metric label="Entradas (crédito)" value={money(data.totalCredito)} />
            <Metric label="Saídas (débito)" value={money(data.totalDebito)} tone={data.totalDebito > 0 ? "alert" : undefined} />
            <Metric label="Saldo do movimento" value={money(data.saldoMovimento)} />
            <Metric label="Lançamentos" value={String(data.quantidade)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 820 }}>
            {data.lancamentos.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum lançamento no período.</p>}
            {data.lancamentos.map((l, i) => {
              const cred = l.tipo === "credito";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
                  <span style={{ fontSize: 12, color: "var(--txt-faint)", width: 86, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "—"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.descricao || l.titulo || "—"}</div>
                    {l.titulo && l.descricao && <div style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{l.titulo}</div>}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: cred ? "#0f6b50" : "#a8332c", whiteSpace: "nowrap" }}>{cred ? "+" : "−"} {money(l.valor)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Contas Bancárias (multi-conta) ---------- */
