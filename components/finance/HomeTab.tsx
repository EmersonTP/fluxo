"use client";
import { useState, useEffect, useCallback } from "react";
import { TabHeader, Alerta } from "./ui";

export function HomeTab({ companyId, go }: { companyId: string; go: (k: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/resumo?company=${companyId}`).then((r) => r.json()).then(setD).finally(() => setLoading(false)); }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR");
  function quando(iso: string | null) {
    if (!iso) return "sem sincronização";
    const ms = Date.now() - new Date(iso).getTime(); const min = Math.floor(ms / 60000), h = Math.floor(min / 60), dias = Math.floor(h / 24);
    return min < 60 ? `há ${min} min` : h < 24 ? `há ${h} h` : dias === 1 ? "ontem" : `há ${dias} dias`;
  }

  const Card = ({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }) => (
    <div onClick={onClick} style={{ flex: 1, minWidth: 170, border: "1px solid var(--line)", borderLeft: `3px solid ${tone || "var(--roxo, #7a4fb0)"}`, borderRadius: "var(--r-card)", padding: "13px 16px", background: "var(--surface)", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: tone || "var(--txt)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <TabHeader title="Visão geral" subtitle="O resumo do financeiro da empresa — atualizado direto do banco." right={<button className="fx-btn" onClick={load} disabled={loading}>{loading ? "…" : "Recarregar"}</button>} />
      {loading && !d && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {d && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Card label="Saldo em caixa" value={money(d.saldoTotal)} sub={d.ultimoSync ? `sincronizado ${quando(d.ultimoSync)}` : "nunca sincronizado"} tone="#7a4fb0" onClick={() => go("fluxo")} />
            <Card label="A pagar (em aberto)" value={money(d.aPagar.total)} sub={`${d.aPagar.qtd} título(s)${d.aPagar.vencidas ? ` · ${d.aPagar.vencidas} vencido(s)` : ""}`} tone={d.aPagar.vencidas ? "#a8332c" : "#274b6d"} onClick={() => go("painel")} />
            <Card label="A receber (em aberto)" value={money(d.aReceber.total)} sub={`${d.aReceber.qtd} título(s)${d.aReceber.vencidas ? ` · ${d.aReceber.vencidas} vencido(s)` : ""}`} tone={d.aReceber.vencidas ? "#b5781f" : "#0f6b50"} onClick={() => go("receber")} />
            <Card label="Sem categoria" value={String(d.semCategoria)} sub="lançamentos a identificar (90d)" tone={d.semCategoria ? "#b5781f" : "#0f6b50"} onClick={() => go("conciliar")} />
          </div>

          {(d.aPagar.vencidas > 0 || d.aReceber.vencidas > 0 || d.semCategoria > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxWidth: 760 }}>
              {d.aPagar.vencidas > 0 && <Alerta tone="critico" txt={`${d.aPagar.vencidas} conta(s) a pagar vencida(s) — ${money(d.aPagar.totalVencidas)}.`} acao="Ver contas a pagar" onClick={() => go("painel")} />}
              {d.aReceber.vencidas > 0 && <Alerta tone="atencao" txt={`${d.aReceber.vencidas} recebível(is) vencido(s) — ${money(d.aReceber.totalVencidas)}.`} acao="Ver contas a receber" onClick={() => go("receber")} />}
              {d.semCategoria > 0 && <Alerta tone="atencao" txt={`${d.semCategoria} lançamento(s) sem categoria nos últimos 90 dias.`} acao="Identificar na conciliação" onClick={() => go("conciliar")} />}
            </div>
          )}

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Últimos lançamentos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {d.ultimos.length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum lançamento ainda.</p>}
                {d.ultimos.map((l: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)" }}>
                    <span style={{ width: 70, color: "var(--txt-faint)" }}>{l.data.slice(5)}</span>
                    <span style={{ flex: 1, color: "var(--txt-soft)" }}>{l.descricao}<span style={{ color: "var(--txt-faint)" }}> · {l.conta}</span></span>
                    <span style={{ color: l.tipo === "credito" ? "#0f6b50" : "#a8332c", fontWeight: 600 }}>{l.tipo === "credito" ? "+" : "−"}{money(l.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Atalhos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[["solicitar", "Solicitar pagamento"], ["fluxo", "Fluxo de Caixa"], ["dre", "DRE"], ["receber", "Contas a Receber"], ["saude", "Saúde do financeiro"]].map(([k, l]) => (
                  <button key={k} className="fx-btn" style={{ justifyContent: "flex-start" }} onClick={() => go(k)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
