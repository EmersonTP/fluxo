"use client";
import { useState, useEffect, useCallback } from "react";
import { Section, TabHeader } from "./ui";

export function SaudeTab({ companyId }: { companyId: string }) {
  type Check = { id: string; label: string; sev: "ok" | "atencao" | "critico"; detalhe: string; acao?: string };
  const [checks, setChecks] = useState<Check[]>([]);
  const [resumo, setResumo] = useState({ critico: 0, atencao: 0, ok: 0 });
  const [loading, setLoading] = useState(true);
  const [conc, setConc] = useState<any>(null);
  const [concLoad, setConcLoad] = useState(false);
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/saude?company=${companyId}`).then((r) => r.json()).then((d) => { setChecks(d.checks || []); setResumo(d.resumo || { critico: 0, atencao: 0, ok: 0 }); }).finally(() => setLoading(false)); }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function rodarConc() { setConcLoad(true); fetch(`/api/finance/conciliacao?company=${companyId}`).then((r) => r.json()).then(setConc).finally(() => setConcLoad(false)); }
  async function identificar(txId: string, categoriaId: string) {
    if (!categoriaId) return;
    await fetch(`/api/finance/lancamentos?company=${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txId, categoriaId }) });
    rodarConc();
  }
  const tone = (s: string) => s === "critico" ? { bg: "#f3dcd8", fg: "#a8332c", dot: "#c0392b", l: "Crítico" } : s === "atencao" ? { bg: "#f6e7cd", fg: "#b5781f", dot: "#d68910", l: "Atenção" } : { bg: "#d7ebe2", fg: "#0f6b50", dot: "#1f9d57", l: "OK" };
  const order: Record<string, number> = { critico: 0, atencao: 1, ok: 2 };
  const sorted = [...checks].sort((a, b) => order[a.sev] - order[b.sev]);
  return (
    <>
      <TabHeader title="Saúde do financeiro" subtitle="A Sandra checa sozinha o que falta configurar ou está pendente." />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {([["critico", resumo.critico, "#a8332c", "#f3dcd8"], ["atencao", resumo.atencao, "#b5781f", "#f6e7cd"], ["ok", resumo.ok, "#0f6b50", "#d7ebe2"]] as const).map(([k, n, fg, bg]) => (
          <div key={k} style={{ flex: 1, minWidth: 130, borderRadius: "var(--r-card)", padding: "12px 15px", background: bg }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: fg }}>{n}</div>
            <div style={{ fontSize: 12, color: fg }}>{k === "ok" ? "OK" : k === "atencao" ? "Atenção" : "Crítico"}</div>
          </div>
        ))}
        <button className="fx-btn" style={{ alignSelf: "center" }} onClick={load}>Recarregar</button>
      </div>
      {loading && <p style={{ color: "var(--txt-faint)" }}>Verificando…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((c) => { const t = tone(c.sev); return (
          <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.dot, marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{c.label} <span style={{ fontSize: 10.5, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: "1px 8px", marginLeft: 4 }}>{t.l}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--txt-soft)", marginTop: 2 }}>{c.detalhe}</div>
              {c.acao && <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 2 }}>→ {c.acao}</div>}
            </div>
          </div>
        ); })}
      </div>

      <Section title="Conciliação / vigilância dos dados">
        <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 10, maxWidth: 720 }}>Cruza o extrato com as contas e regras e aponta divergências: lançamentos sem categoria, contas desatualizadas, contas faltando. Roda nos últimos 90 dias.</div>
        <button className="fx-btn fx-btn-primary" onClick={rodarConc} disabled={concLoad}>{concLoad ? "Cruzando dados…" : "Rodar conciliação"}</button>
        {conc && (
          <div style={{ marginTop: 14 }}>
            {(conc.alertas || []).map((a: any, i: number) => { const t = tone(a.sev); return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--txt-soft)" }}>{a.texto}</span>
              </div>
            ); })}
            {conc.contas?.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--txt-soft)" }}>
                <b>Contas:</b> {conc.contas.map((c: any) => `${c.nome} (${c.total} lanç.${c.ultimo ? ", último " + new Date(c.ultimo).toLocaleDateString("pt-BR") : ""})`).join(" · ")}
              </div>
            )}
            {conc.naoCategorizado?.qtd > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--coral-deep)", marginBottom: 6 }}>Sem categoria ({conc.naoCategorizado.qtd}) — {money(conc.naoCategorizado.valor)}</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginBottom: 6 }}>Identifique cada lançamento escolhendo a categoria — ela é fixada nesse lançamento e tem prioridade sobre as regras.</div>
                {conc.naoCategorizado.itens.map((it: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--txt-soft)", padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ width: 64, color: "var(--txt-faint)" }}>{new Date(it.data).toLocaleDateString("pt-BR").slice(0, 5)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{it.descricao} <span style={{ color: "var(--txt-faint)" }}>· {it.origem}</span></span>
                    <span style={{ color: it.tipo === "credito" ? "#0f6b50" : "#a8332c", width: 90, textAlign: "right" }}>{it.tipo === "credito" ? "+" : "−"}{money(it.valor)}</span>
                    {it.id && (
                      <select className="fx-input" defaultValue="" style={{ maxWidth: 190, fontSize: 12 }} onChange={(e) => { if (e.target.value) identificar(it.id, e.target.value); }}>
                        <option value="">categoria…</option>
                        {(conc.categorias || []).map((c: any) => <option key={c.id} value={c.id}>{c.grupo} › {c.nome}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
    </>
  );
}
