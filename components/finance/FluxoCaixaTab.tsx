"use client";
import { useState, useEffect, useCallback } from "react";
import { Field } from "./ui";

export function FluxoCaixaTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const hoje = new Date();
  const fmtY = (d: Date) => d.toISOString().slice(0, 10);
  const [de, setDe] = useState(fmtY(new Date(2026, 2, 1)));
  const [ate, setAte] = useState(fmtY(hoje));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [aberta, setAberta] = useState<string | null>(null); // categoria expandida (drill-down)
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR");
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mesLabel = (m: string) => { const [y, mm] = m.split("-"); return `${MES[(+mm || 1) - 1]}/${y.slice(2)}`; };

  const load = useCallback(() => {
    setLoading(true); setErr("");
    fetch(`/api/finance/fluxo-caixa?company=${companyId}&de=${de}&ate=${ate}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro"); return d; })
      .then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [companyId, de, ate]);
  useEffect(() => { load(); }, [load]);

  async function seed() {
    setSeeding(true);
    await fetch(`/api/finance/plano/seed?company=${companyId}`, { method: "POST" });
    setSeeding(false); load();
  }
  async function sincronizar() {
    setSyncing(true); setSyncMsg("");
    try {
      const r = await fetch(`/api/finance/inter/sync?company=${companyId}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao sincronizar");
      setSyncMsg(typeof d.criados === "number" ? `${d.criados} novo(s) lançamento(s)` : "Sincronizado");
    } catch (e: any) { setSyncMsg(e.message || "Falha"); }
    setSyncing(false); load();
  }

  function quando(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso); const ms = Date.now() - d.getTime();
    const min = Math.floor(ms / 60000), h = Math.floor(min / 60), dias = Math.floor(h / 24);
    const rel = min < 1 ? "agora" : min < 60 ? `há ${min} min` : h < 24 ? `há ${h} h` : dias === 1 ? "ontem" : `há ${dias} dias`;
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${rel})`;
  }
  const fresco = data?.ultimoSync ? (Date.now() - new Date(data.ultimoSync).getTime()) < 36 * 3600 * 1000 : false;

  const BLOCO: Record<string, { l: string; c: string }> = {
    operacional: { l: "Operacional", c: "#7a3fa0" }, investimento: { l: "Investimento", c: "#274b6d" },
    financiamento: { l: "Financiamento", c: "#0f6b50" }, interno: { l: "Interno (transferências)", c: "#7a7f87" },
  };

  // ---- gráfico: barras entradas x saídas por mês + linha de saldo final ----
  function Chart({ porMes }: { porMes: any[] }) {
    if (!porMes || porMes.length === 0) return null;
    const W = 760, H = 260, padL = 8, padR = 8, padT = 18, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = porMes.length;
    const groupW = plotW / n;
    const maxFluxo = Math.max(1, ...porMes.map((p) => Math.max(p.entradas, p.saidas)));
    const saldos = porMes.map((p) => p.saldoFinal);
    const sMin = Math.min(0, ...saldos), sMax = Math.max(1, ...saldos);
    const barH = (v: number) => (v / maxFluxo) * plotH;
    const yBase = padT + plotH;
    const sY = (v: number) => padT + plotH - ((v - sMin) / (sMax - sMin || 1)) * plotH;
    const bw = Math.min(46, groupW * 0.3);
    const pts = porMes.map((p, i) => `${padL + groupW * (i + 0.5)},${sY(p.saldoFinal)}`).join(" ");
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 14px 4px", marginBottom: 18, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 4, fontSize: 11.5, color: "var(--txt-soft)" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1f9d57", borderRadius: 2, marginRight: 5 }} />Entradas</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#d06b62", borderRadius: 2, marginRight: 5 }} />Saídas</span>
          <span><span style={{ display: "inline-block", width: 14, height: 3, background: "#7a4fb0", borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />Saldo no fim do mês</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, height: "auto", display: "block" }}>
          <line x1={padL} y1={yBase} x2={W - padR} y2={yBase} stroke="var(--line)" />
          {porMes.map((p, i) => {
            const cx = padL + groupW * (i + 0.5);
            return (
              <g key={i}>
                <rect x={cx - bw - 2} y={yBase - barH(p.entradas)} width={bw} height={barH(p.entradas)} rx={3} fill="#1f9d57" opacity={0.88} />
                <rect x={cx + 2} y={yBase - barH(p.saidas)} width={bw} height={barH(p.saidas)} rx={3} fill="#d06b62" opacity={0.88} />
                <text x={cx} y={H - 16} textAnchor="middle" fontSize={12} fill="var(--txt-soft)">{mesLabel(p.mes)}</text>
              </g>
            );
          })}
          <polyline points={pts} fill="none" stroke="#7a4fb0" strokeWidth={2.5} />
          {porMes.map((p, i) => {
            const cx = padL + groupW * (i + 0.5);
            return (
              <g key={"s" + i}>
                <circle cx={cx} cy={sY(p.saldoFinal)} r={4} fill="#7a4fb0" stroke="var(--surface)" strokeWidth={1.5} />
                <text x={cx} y={sY(p.saldoFinal) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="#7a4fb0">{(p.saldoFinal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13.5, color: "var(--txt-soft)" }}><b>Fluxo de Caixa</b> (regime de caixa) — saldo das contas e movimento mês a mês, direto do extrato do Inter.</div>
        </div>
        <Field label="De"><input className="fx-input" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
        <Field label="Até"><input className="fx-input" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
        <button className="fx-btn" disabled={loading} onClick={load}>{loading ? "…" : "Atualizar"}</button>
        {isAdmin && <button className="fx-btn" disabled={seeding} onClick={seed} title="Cria/atualiza o plano de contas e as regras de categorização">{seeding ? "Configurando…" : "Configurar plano"}</button>}
      </div>

      {/* selo de atualização + sincronizar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16, fontSize: 12.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: fresco ? "#d7ebe2" : "#f6e7cd", color: fresco ? "#0f6b50" : "#b5781f", borderRadius: 999, padding: "3px 11px", fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: fresco ? "#1f9d57" : "#d68910" }} />
          {data?.ultimoSync ? `Atualizado ${quando(data.ultimoSync)}` : "Aguardando 1ª sincronização"}
        </span>
        <button className="fx-btn" disabled={syncing} onClick={sincronizar} title="Puxa o extrato do Inter agora">{syncing ? "Sincronizando…" : "↻ Sincronizar agora"}</button>
        {syncMsg && <span style={{ color: "var(--txt-faint)" }}>{syncMsg}</span>}
        <span style={{ color: "var(--txt-faint)" }}>· sincroniza sozinho todo dia às 7h</span>
      </div>

      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "12px 15px", fontSize: 13.5, maxWidth: 680 }}>{err}</div>}
      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}

      {data && !loading && (
        <>
          {data.saldos && data.saldos.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "stretch" }}>
              {data.saldos.map((c: any, i: number) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 16px", background: "var(--surface)", minWidth: 150 }}>
                  <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{c.nome}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{c.saldo == null ? "—" : money(c.saldo)}</div>
                </div>
              ))}
              <div style={{ border: "2px solid var(--roxo, #7a4fb0)", borderRadius: "var(--r-card)", padding: "12px 16px", background: "rgba(146,80,172,.06)", minWidth: 160 }}>
                <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>Saldo total (caixa)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--roxo, #7a4fb0)" }}>{money(data.saldoTotal)}</div>
              </div>
            </div>
          )}

          <Chart porMes={data.porMes} />

          {/* tabela mês a mês: saldo inicial -> entradas -> saídas -> saldo final */}
          {data.porMes && data.porMes.length > 0 && (
            <div style={{ overflowX: "auto", marginBottom: 22, maxWidth: 980 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 480 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--txt-soft)", fontWeight: 600 }}> </th>
                    {data.porMes.map((p: any) => <th key={p.mes} style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>{mesLabel(p.mes)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { l: "Saldo inicial", k: "saldoInicial", c: "var(--txt-soft)", b: false },
                    { l: "(+) Entradas", k: "entradas", c: "#0f6b50", b: false },
                    { l: "(−) Saídas", k: "saidas", c: "#a8332c", b: false },
                    { l: "(=) Saldo final", k: "saldoFinal", c: "var(--txt)", b: true },
                  ].map((row) => (
                    <tr key={row.k} style={{ borderBottom: "1px solid var(--line)", background: row.b ? "rgba(146,80,172,.05)" : undefined }}>
                      <td style={{ padding: "8px 10px", color: row.c, fontWeight: row.b ? 700 : 500 }}>{row.l}</td>
                      {data.porMes.map((p: any) => (
                        <td key={p.mes} style={{ textAlign: "right", padding: "8px 10px", color: row.c, fontWeight: row.b ? 700 : 500 }}>
                          {row.k === "saidas" ? "−" : ""}{money(p[row.k]).replace("−", row.k === "saidas" ? "" : "−")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Detalhe por categoria <span style={{ fontWeight: 400, textTransform: "none", color: "var(--txt-faint)" }}>— clique para ver os lançamentos</span></div>

          {data.blocos.map((b: any) => {
            const bl = BLOCO[b.bloco] || { l: b.bloco, c: "var(--txt-soft)" };
            return (
              <div key={b.bloco} style={{ marginBottom: 22, maxWidth: 980 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, borderLeft: `3px solid ${bl.c}`, paddingLeft: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: bl.c }}>{bl.l}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{money(b.liquido)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {b.categorias.map((c: any) => {
                    const key = b.bloco + c.grupo + c.nome;
                    const aberto = aberta === key;
                    return (
                      <div key={key} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", overflow: "hidden" }}>
                        <div onClick={() => setAberta(aberto ? null : key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", fontSize: 13, cursor: "pointer" }}>
                          <span style={{ width: 12, color: "var(--txt-faint)", fontSize: 11 }}>{aberto ? "▾" : "▸"}</span>
                          <span style={{ flex: 1 }}><span style={{ color: "var(--txt-faint)" }}>{c.grupo} ›</span> <b>{c.nome}</b> <span style={{ color: "var(--txt-faint)", fontSize: 11.5 }}>({c.itens.length})</span></span>
                          {c.entrada > 0 && <span style={{ color: "#0f6b50", fontSize: 12.5 }}>+{money(c.entrada)}</span>}
                          {c.saida > 0 && <span style={{ color: "#a8332c", fontSize: 12.5 }}>−{money(c.saida)}</span>}
                          <span style={{ fontWeight: 600, width: 110, textAlign: "right" }}>{money(c.liquido)}</span>
                        </div>
                        {aberto && (
                          <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg, #faf8fb)", padding: "4px 13px 8px 35px" }}>
                            {c.itens.map((it: any, idx: number) => (
                              <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "4px 0", borderBottom: idx < c.itens.length - 1 ? "1px solid var(--line)" : undefined }}>
                                <span style={{ width: 78, color: "var(--txt-faint)" }}>{it.data}</span>
                                <span style={{ flex: 1, color: "var(--txt-soft)" }}>{it.descricao}</span>
                                <span style={{ color: it.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{it.tipo === "credito" ? "+" : "−"}{money(it.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {data.naoCategorizado.itens.length > 0 && (
            <div style={{ marginTop: 8, maxWidth: 980 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b5781f", marginBottom: 6 }}>Não categorizado ({data.naoCategorizado.itens.length}) — entradas {money(data.naoCategorizado.entrada)} · saídas {money(data.naoCategorizado.saida)}</div>
              <div style={{ fontSize: 12, color: "var(--txt-faint)", marginBottom: 8 }}>Lançamentos sem regra. Conforme criamos regras, eles entram nos blocos acima.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {data.naoCategorizado.itens.slice(0, 15).map((i: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--txt-soft)", padding: "4px 13px" }}>
                    <span style={{ width: 80, color: "var(--txt-faint)" }}>{i.data}</span>
                    <span style={{ flex: 1 }}>{i.descricao}</span>
                    <span style={{ color: i.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{i.tipo === "credito" ? "+" : "−"}{money(i.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Segurança & LGPD ---------- */
/* ---------- Saúde / Alertas do financeiro ---------- */
