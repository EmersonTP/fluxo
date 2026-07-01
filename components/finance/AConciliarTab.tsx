"use client";
import { useState, useEffect, useCallback } from "react";

type Lanc = { id: string; data: string; descricao: string; valor: number; tipo: string; conta?: string; categoria?: string | null; conciliado?: boolean; requestId?: string | null };
type Rec = { id: string; descricao: string; valor: number; status: string; cliente?: string | null; vencimento?: string | null; conciliado?: boolean };

export function AConciliarTab({ companyId }: { companyId: string }) {
  const [aCasar, setACasar] = useState<Lanc[]>([]);
  const [semLastro, setSemLastro] = useState<Rec[]>([]);
  const [titulos, setTitulos] = useState<Rec[]>([]);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [catsRec, setCatsRec] = useState<{ id: string; grupo: string; nome: string }[]>([]);
  const [catTx, setCatTx] = useState<Lanc | null>(null);
  const [catLinhas, setCatLinhas] = useState<{ clienteId: string; valor: string }[]>([]);
  const [catCatId, setCatCatId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const brl = (v: number) => "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const mesLabel = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "";

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/finance/conciliar?company=${companyId}`).then((r) => r.json()),
      fetch(`/api/finance/receber?company=${companyId}`).then((r) => r.json()),
    ]).then(([conc, rec]: any[]) => {
      const lanc: Lanc[] = conc.lancamentos || [];
      const recs: Rec[] = rec.recebiveis || [];
      // recebimentos (créditos) de receita ainda sem dono (sem título amarrado)
      setACasar(lanc.filter((t) => t.tipo === "credito" && !t.conciliado && /receita|membership|sem categoria/i.test((t.categoria || "sem categoria"))));
      // títulos marcados pagos mas sem lastro no extrato
      setSemLastro(recs.filter((r) => r.status === "paga" && !r.conciliado));
      // títulos em aberto (candidatos pra casar)
      setTitulos(recs.filter((r) => r.status === "pendente" || r.status === "vencida"));
    }).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`/api/finance/clientes?company=${companyId}`).then((r) => r.json()).then((d) => setClientes((d.clientes || []).map((c: any) => ({ id: c.id, nome: c.nome })))).catch(() => {});
    fetch(`/api/finance/categorias?company=${companyId}`).then((r) => r.json()).then((d) => setCatsRec(((d.categorias || d || []) as any[]).filter((c) => c.tipo === "receita"))).catch(() => {});
  }, [companyId]);

  async function casar(creditId: string) {
    const ids = sel[creditId] || [];
    if (!ids.length) { setMsg("Escolha ao menos um pagamento antes de casar."); return; }
    setBusy(creditId); setMsg("");
    const r = await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "casar_multiplo", transactionId: creditId, requestIds: ids }) });
    setBusy("");
    if (r.ok) { setMsg("✓ Casado."); setSel((s) => { const n = { ...s }; delete n[creditId]; return n; }); load(); } else { const d = await r.json().catch(() => ({})); setMsg(d.error || "Erro ao casar."); }
  }
  function openCat(t: Lanc) {
    setCatTx(t);
    setCatLinhas([{ clienteId: "", valor: String(Math.abs(t.valor || 0)) }]);
    const mem = catsRec.find((c) => /member/i.test(c.nome || ""));
    setCatCatId(mem?.id || catsRec[0]?.id || "");
  }
  async function salvarCat() {
    if (!catTx) return;
    const linhas = catLinhas.filter((l) => l.clienteId && Number(l.valor) > 0).map((l) => ({ clienteId: l.clienteId, valorCents: Math.round(Number(l.valor) * 100) }));
    if (!linhas.length) { setMsg("Adicione ao menos um paciente com valor."); return; }
    setBusy(catTx.id); setMsg("");
    const r = await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "categorizar", transactionId: catTx.id, categoriaId: catCatId || null, linhas }) });
    setBusy("");
    if (r.ok) { setMsg("\u2713 Categorizado."); setCatTx(null); load(); } else { const d = await r.json().catch(() => ({})); setMsg(d.error || "Erro ao categorizar."); }
  }
  async function lastroManual(recId: string) {
    if (!confirm("Marcar como recebido com lastro? Use quando o dinheiro caiu junto num pagamento conjunto já conciliado, ou veio por Mercado Pago.")) return;
    setBusy(recId); setMsg("");
    const r = await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lastro_manual", receivableId: recId }) });
    setBusy(""); if (r.ok) { setMsg("\u2713 Marcado com lastro."); } load();
  }
  async function marcarSemTitulo(creditId: string) {
    setBusy(creditId);
    await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: creditId }) }).catch(() => {});
    setBusy(""); load();
  }

  const titOptions = [...titulos].sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
  const pagosOptions = [...semLastro].sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
  const card = (label: string, n: number, cor: string) => (
    <div style={{ flex: "1 1 130px", minWidth: 120, border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor }}>{n}</div>
    </div>
  );

  if (loading) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;
  const tudoLimpo = aCasar.length === 0 && semLastro.length === 0;

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 720 }}><b>A conciliar.</b> Rotina de fechamento: case cada recebimento com o paciente e revise o que foi marcado pago sem ter caído no extrato. Quando zerar, está tudo com lastro.</div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "9px 13px", fontSize: 13, marginBottom: 12, maxWidth: 520 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {card("Recebimentos a casar", aCasar.length, aCasar.length ? "#b5781f" : "#0f6b50")}
        {card("Pagos sem lastro", semLastro.length, semLastro.length ? "#a8332c" : "#0f6b50")}
        {card("Títulos em aberto", titulos.length, "var(--txt)")}
      </div>

      {tudoLimpo && (
        <div style={{ border: "1px solid #9fe1cb", background: "var(--verde-soft, #d7ebe2)", color: "#0c5a44", borderRadius: "var(--r-card)", padding: "16px 18px", fontWeight: 600 }}>✓ Tudo conciliado. Nenhum recebimento pendente de casar e nenhum pago sem lastro.</div>
      )}

      {aCasar.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Recebimentos a casar com paciente ({aCasar.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {aCasar.map((t) => {
              const selIds = sel[t.id] || [];
              const pool = [...semLastro, ...titulos];
              const selRecs = selIds.map((id) => pool.find((r) => r.id === id)).filter(Boolean) as Rec[];
              const soma = selRecs.reduce((acc, r) => acc + (r.valor || 0), 0);
              const mismatch = selRecs.length > 0 && Math.abs(soma - Math.abs(t.valor || 0)) > 0.5;
              return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: mismatch ? "1px solid #e4b8b1" : "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
                <div style={{ flex: "1 1 220px", minWidth: 190 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{(t.descricao || "Recebimento").replace("PIX RECEBIDO - Cp :", "").replace(/^\d+-/, "")}</div>
                  <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{dt(t.data)} · {t.conta || "—"} · {t.categoria || "sem categoria"}</div>
                </div>
                <b style={{ color: "#0f6b50", minWidth: 90, textAlign: "right" }}>{brl(t.valor)}</b>
                <button className="fx-btn fx-btn-primary" style={{ fontSize: 12.5 }} disabled={busy === t.id} onClick={() => openCat(t)} title="Atribuir a um ou mais pacientes (pagamento que cruza vários clientes)">Categorizar</button>
                <select className="fx-input" style={{ flex: "0 0 200px", maxWidth: 200, fontSize: 12 }} value="" onChange={(e) => { const v = e.target.value; if (!v) return; setSel((s) => ({ ...s, [t.id]: Array.from(new Set([...(s[t.id] || []), v])) })); }}>
                  <option value="">{selIds.length ? "+ adicionar outro pagamento" : "— casar com pagamento —"}</option>
                  {pagosOptions.length > 0 && (
                    <optgroup label="Pagamentos já registrados (sem lastro)">
                      {pagosOptions.map((r) => <option key={r.id} value={r.id}>{r.cliente || "—"} · {brl(r.valor)}{r.vencimento ? ` · ${mesLabel(r.vencimento)}` : ""}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Títulos em aberto (futuros)">
                    {titOptions.map((r) => <option key={r.id} value={r.id}>{r.cliente || "—"} · {brl(r.valor)}{r.vencimento ? ` · ${mesLabel(r.vencimento)} (vence ${dt(r.vencimento)})` : ""}</option>)}
                  </optgroup>
                </select>
                <button className="fx-btn" style={{ fontSize: 12 }} disabled={busy === t.id || selIds.length === 0} onClick={() => casar(t.id)} title="Casar com um pagamento já registrado (sem lastro)">{busy === t.id ? "…" : `casar existente${selIds.length > 1 ? ` (${selIds.length})` : ""}`}</button>
                <button className="fx-btn" style={{ fontSize: 11.5, color: "var(--txt-faint)" }} disabled={busy === t.id} onClick={() => marcarSemTitulo(t.id)} title="NÃO é receita de paciente (ex.: transferência, aporte, estorno). Receita de paciente use Categorizar.">não é de paciente</button>
                {selRecs.length > 0 && (
                  <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
                    {selRecs.map((r) => (
                      <span key={r.id} style={{ fontSize: 11.5, background: "var(--col, #f4eef7)", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 8px", display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {r.cliente || "—"} · {brl(r.valor)}
                        <button onClick={() => setSel((s) => ({ ...s, [t.id]: (s[t.id] || []).filter((x) => x !== r.id) }))} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 13, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                    {selRecs.length > 1 && <span style={{ fontSize: 11.5, color: mismatch ? "#a8332c" : "#0f6b50", fontWeight: 600 }}>soma {brl(soma)}</span>}
                  </div>
                )}
                {mismatch && (
                  <div style={{ flexBasis: "100%", fontSize: 11.5, color: "#a8332c", marginTop: 2 }}>⚠ Soma dos pagamentos ({brl(soma)}) não bate com o recebido ({brl(t.valor)}). Se foi pagamento conjunto com arredondamento, pode casar mesmo assim; senão, revise a seleção.</div>
                )}
              </div>
              );
            })}
          </div>
        </section>
      )}

      {semLastro.length > 0 && (
        <section>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Títulos marcados pagos SEM lastro no extrato ({semLastro.length})</div>
          <div style={{ fontSize: 12.5, color: "var(--txt-soft)", marginBottom: 8, maxWidth: 640 }}>Alguém deu baixa, mas não há crédito conciliado batendo. Confira: ou o dinheiro caiu por outra conta (Mercado Pago?) e precisa casar acima, ou a baixa foi indevida.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {semLastro.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "9px 13px", background: "var(--surface)", fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b5781f", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cliente || r.descricao}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 8px" }}>sem lastro</span>
                <button className="fx-btn" style={{ fontSize: 11 }} disabled={busy === r.id} onClick={() => lastroManual(r.id)} title="Marcar como recebido (caiu em pagamento conjunto já conciliado ou via Mercado Pago)">marcar recebido</button>
                <b style={{ minWidth: 84, textAlign: "right" }}>{brl(r.valor)}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {catTx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setCatTx(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, width: 540, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Categorizar recebimento</div>
            <div style={{ fontSize: 12.5, color: "var(--txt-faint)", marginBottom: 14 }}>{dt(catTx.data)} · recebido <b style={{ color: "#0f6b50" }}>{brl(catTx.valor)}</b>. Diga de quais pacientes é esse dinheiro — pode dividir entre vários.</div>
            <label style={{ fontSize: 12, color: "var(--txt-soft)" }}>Categoria de receita</label>
            <select className="fx-input" value={catCatId} onChange={(e) => setCatCatId(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
              {catsRec.length === 0 && <option value="">—</option>}
              {catsRec.map((c) => <option key={c.id} value={c.id}>{c.grupo} › {c.nome}</option>)}
            </select>
            {catLinhas.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <select className="fx-input" value={l.clienteId} onChange={(e) => { const n = [...catLinhas]; n[i] = { ...n[i], clienteId: e.target.value }; setCatLinhas(n); }} style={{ flex: 1 }}>
                  <option value="">— paciente —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <input className="fx-input" type="number" value={l.valor} onChange={(e) => { const n = [...catLinhas]; n[i] = { ...n[i], valor: e.target.value }; setCatLinhas(n); }} style={{ width: 110 }} placeholder="R$" />
                {catLinhas.length > 1 && <button className="fx-btn" onClick={() => setCatLinhas(catLinhas.filter((_, j) => j !== i))} style={{ color: "var(--coral-deep)" }}>×</button>}
              </div>
            ))}
            <button className="fx-btn" style={{ fontSize: 12.5, marginTop: 2 }} onClick={() => setCatLinhas([...catLinhas, { clienteId: "", valor: "" }])}>+ adicionar paciente</button>
            {(() => { const soma = catLinhas.reduce((a, l) => a + (Number(l.valor) || 0), 0); const ok = Math.abs(soma - Math.abs(catTx.valor || 0)) <= 0.5; return (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: ok ? "#0f6b50" : "#a8332c" }}>Soma {brl(soma)} de {brl(catTx.valor)} {ok ? "✓" : "— não bate (ok se foi arredondamento)"}</div>
            ); })()}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="fx-btn fx-btn-primary" disabled={busy === catTx.id} onClick={salvarCat}>{busy === catTx.id ? "Salvando…" : "Salvar categorização"}</button>
              <button className="fx-btn" onClick={() => setCatTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
