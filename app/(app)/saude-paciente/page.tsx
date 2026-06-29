"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckinSessaoView } from "@/components/CheckinSessaoView";

const COR = { verde: "#0f6b50", amarelo: "#b5781f", vermelho: "#a8332c" } as const;
const BG = { verde: "#d7ebe2", amarelo: "#f6e7cd", vermelho: "#f3dcd8" } as const;
const PG: Record<string, { label: string; cor: string }> = {
  em_dia: { label: "em dia", cor: "#0f6b50" },
  vence: { label: "vence ≤7d", cor: "#b5781f" },
  atrasado: { label: "atrasado", cor: "#a8332c" },
};

export default function SaudePacientePage() {
  const [tab, setTab] = useState<"saude" | "checkin" | "metricas">("saude");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "14px 28px 0", borderBottom: "1px solid var(--line)" }}>
        {([["saude", "Saúde"], ["metricas", "Métricas"], ["checkin", "Check-in da sessão"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: tab === k ? "2px solid var(--roxo)" : "2px solid transparent", padding: "8px 10px", fontWeight: tab === k ? 700 : 500, color: tab === k ? "var(--txt)" : "var(--txt-soft)", cursor: "pointer", fontSize: 14 }}>{l}</button>
        ))}
      </div>
      {tab === "saude" ? <SaudeView /> : tab === "metricas" ? <MetricasView /> : <CheckinSessaoView />}
    </div>
  );
}

function SaudeView() {
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fichaId, setFichaId] = useState("");
  const [ficha, setFicha] = useState<any>(null);
  const [fichaLoad, setFichaLoad] = useState(false);
  async function abrirFicha(id: string) { setFichaId(id); setFicha(null); setFichaLoad(true); try { const d = await fetch(`/api/finance/clientes/${id}`).then((r) => r.json()); setFicha(d); } catch { setFicha({ error: "Erro ao carregar." }); } setFichaLoad(false); }

  useEffect(() => {
    let c = "";
    try { c = localStorage.getItem("fx:company") || ""; } catch {}
    if (c) { setCompanyId(c); return; }
    fetch("/api/companies").then((r) => r.json()).then((d) => setCompanyId((d.companies || [])[0]?.id || "")).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    fetch(`/api/cs/pacientes?company=${companyId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const r = data?.resumo;
  const pacientes = data?.pacientes || [];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Customer Success</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 700 }}>Saúde do Paciente</div>
          <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 2 }}>Termômetro por paciente: presença nas sessões + pagamento. Quanto mais o Nicolas registra, mais preciso fica.</div>
        </div>
        <button className="fx-btn" onClick={load} disabled={loading}>{loading ? "…" : "Recarregar"}</button>
      </div>

      {r && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          {([["vermelho", "Em risco"], ["amarelo", "Atenção"], ["verde", "Saudável"]] as const).map(([k, lbl]) => (
            <div key={k} style={{ flex: 1, minWidth: 150, border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 16px" }}>
              <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>{lbl}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: COR[k] }}>{(r as any)[k]}</div>
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 150, border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 16px" }}>
            <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>Total de pacientes</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{r.total}</div>
          </div>
        </div>
      )}

      {loading && !data && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {data && pacientes.length === 0 && (
        <p style={{ color: "var(--txt-faint)" }}>Nenhum paciente cadastrado ainda. Cadastre em Finanças → Contas a Receber → Memberships, e marque presença na aba Check-in da sessão.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pacientes.map((p: any) => (
          <div key={p.id} onClick={() => abrirFicha(p.id)} title="Abrir ficha do paciente" style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--line)", borderLeft: `4px solid ${COR[p.score as keyof typeof COR]}`, borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 16px", flexWrap: "wrap", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-soft, rgba(146,80,172,.05))"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface)"; }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: COR[p.score as keyof typeof COR], flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 14, minWidth: 160, flex: 1 }}>{p.nome} <span style={{ fontSize: 11, color: "var(--roxo)", fontWeight: 600 }}>· ver ficha →</span></span>
            <span style={{ fontSize: 12.5, color: "var(--txt-soft)", minWidth: 130 }}>
              Presença: {p.presenca.total ? `${p.presenca.presentes}/${p.presenca.total}${p.presenca.taxa !== null ? ` (${p.presenca.taxa}%)` : ""}` : "—"}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: PG[p.pagamento]?.cor, minWidth: 90 }}>{PG[p.pagamento]?.label}</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 2, minWidth: 200 }}>
              {p.flags.length === 0 ? <span style={{ fontSize: 12, color: "#0f6b50" }}>✓ tudo certo</span> :
                p.flags.map((f: string, i: number) => (
                  <span key={i} style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, color: COR[p.score as keyof typeof COR], background: BG[p.score as keyof typeof BG] }}>{f}</span>
                ))}
            </span>
          </div>
        ))}
      </div>

      {fichaId && (
        <div onClick={() => setFichaId("")} style={{ position: "fixed", inset: 0, background: "rgba(20,12,30,.45)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "5vh 16px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "var(--r-card)", width: "100%", maxWidth: 680, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden" }}>
            {fichaLoad && <div style={{ padding: 28, color: "var(--txt-faint)" }}>Carregando ficha…</div>}
            {!fichaLoad && ficha?.error && <div style={{ padding: 28, color: "#a8332c" }}>{ficha.error}</div>}
            {!fichaLoad && ficha?.cliente && (() => {
              const cl = ficha.cliente, re = ficha.resumo, as = ficha.assinatura, q = ficha.qualificacao;
              const dt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
              const brl = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
              const stCor: Record<string, string> = { paga: "#0f6b50", pendente: "#b5651d", vencida: "#a8332c", cancelada: "#9a8f84" };
              const card = (label: string, valor: string, cor?: string) => (
                <div style={{ flex: 1, minWidth: 120, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: cor || "var(--txt)", marginTop: 2 }}>{valor}</div>
                </div>
              );
              return (
                <div>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{cl.nome}</div>
                      <div style={{ fontSize: 12.5, color: "var(--txt-faint)", marginTop: 3 }}>{cl.documento ? `CPF ${cl.documento} · ` : ""}cliente desde {dt(re.desdeCliente)}</div>
                    </div>
                    <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => setFichaId("")}>fechar</button>
                  </div>
                  <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {card("MRR", brl(re.mrr))}
                      {card("Em aberto", brl(re.emAbertoValor), re.emAbertoValor > 0 ? "#b5651d" : undefined)}
                      {card("Vencido", brl(re.vencidoValor) + (re.vencidoCount ? ` (${re.vencidoCount})` : ""), re.vencidoValor > 0 ? "#a8332c" : undefined)}
                      {card("Pago", brl(re.pagoTotal), "#0f6b50")}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Plano · Qualificação</div>
                      <div style={{ fontSize: 13.5 }}>{as ? <>{as.plano} · <b>{brl(as.valor)}/mês</b> · desde {dt(as.desde)} · próxima {dt(as.proximaCobranca)}</> : "Sem assinatura ativa."}</div>
                      <div style={{ fontSize: 13.5, marginTop: 3 }}>{q.taxaPresenca === null ? "Sem sessões marcadas ainda." : <>Presença: <b>{q.taxaPresenca}%</b> ({q.presentes}/{q.marcadas}) · último pagamento {dt(re.ultimoPagamento)}</>}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Recebíveis ({ficha.recebiveis.length})</div>
                      {ficha.recebiveis.length === 0 ? <div style={{ fontSize: 13, color: "var(--txt-faint)" }}>Nenhuma conta a receber.</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {ficha.recebiveis.map((r: any) => (
                            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: stCor[r.status] || "#9a8f84" }} />
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descricao || "Conta a receber"}</span>
                              <span style={{ color: "var(--txt-faint)", fontSize: 12 }}>{r.status === "paga" ? "pago " + dt(r.pagoEm) : "vence " + dt(r.vencimento)}</span>
                              <b style={{ minWidth: 84, textAlign: "right" }}>{brl(r.valor)}</b>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{cl.email || ""}{cl.telefone ? ` · ${cl.telefone}` : ""}{cl.endereco ? ` · ${cl.endereco}` : ""}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}


const ROTINA_LIST_ID = "cmqjngc9i046ytox30huda7ue"; // Rotina - Nicolas

function MetricasView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); fetch(`/api/cs/metricas-rotina?list=${ROTINA_LIST_ID}`).then((r) => r.json()).then(setD).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  const hoje = d?.hoje || [];
  const semana = d?.semana || [];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Customer Success</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 700 }}>Métricas da Rotina — Nicolas</div>
          <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 2 }}>O que ele fez × a meta. Os números vêm dos campos da rotina; a cada abertura, a Sandra guarda o do dia.</div>
        </div>
        <button className="fx-btn" onClick={load} disabled={loading}>{loading ? "…" : "Recarregar"}</button>
      </div>

      {loading && !d && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {d && hoje.length === 0 && (
        <p style={{ color: "var(--txt-faint)" }}>Sem números ainda. Abra a rotina do Nicolas, e em cada item (ex.: "abastecer com 3 mensagens") adicione um campo personalizado do tipo Número e preencha o valor do dia.</p>
      )}

      {hoje.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", margin: "4px 0 10px" }}>Hoje</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
            {hoje.map((m: any, i: number) => {
              const feito = m.tipo === "numero" ? Number(m.valor) : null;
              const pct = m.meta && feito != null ? Math.min(100, Math.round((feito / m.meta) * 100)) : null;
              const bateu = m.meta != null && feito != null && feito >= m.meta;
              return (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "11px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 200 }}>{m.label} <span style={{ color: "var(--txt-faint)", fontWeight: 400 }}>· {m.itemNome.replace(/^\[[^\]]+\]\s*/, "")}</span></span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: bateu ? "#0f6b50" : "var(--txt)" }}>
                      {m.valor}{m.meta != null ? <span style={{ color: "var(--txt-faint)", fontWeight: 600 }}> / {m.meta}</span> : ""}
                    </span>
                  </div>
                  {pct != null && (
                    <span style={{ display: "block", marginTop: 8, height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${pct}%`, background: bateu ? "#0f6b50" : "var(--roxo)" }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {semana.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", margin: "4px 0 10px" }}>Últimos 7 dias</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {semana.map((s: any, i: number) => (
              <div key={i} style={{ flex: 1, minWidth: 180, border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 16px" }}>
                <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>{s.label}</div>
                {s.tipo === "numero"
                  ? <div style={{ fontSize: 24, fontWeight: 800 }}>{s.total}<span style={{ fontSize: 12, color: "var(--txt-faint)", fontWeight: 600 }}> no total · {s.dias} dia(s)</span></div>
                  : <div style={{ fontSize: 14, fontWeight: 700 }}>{s.dias} registro(s)</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
