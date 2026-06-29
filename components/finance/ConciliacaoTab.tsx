"use client";
import { useState, useEffect, useCallback } from "react";

export function ConciliacaoTab({ companyId }: { companyId: string }) {
  type Sug = { tipo: string; id: string; descricao: string; valor: number; status: string; vencimento?: string | null; contraparte?: string; metodo?: string | null };
  type Lanc = { id: string; data: string; descricao: string; valor: number; tipo: string; conta: string; categoria: string | null; conciliado: boolean; requestId: string | null; sugestoes: Sug[] };
  type Cat = { id: string; grupo: string; nome: string };
  type Conta = { id: string; nome: string; tipo: string };
  type Data = { total: number; pendentes: number; lancamentos: Lanc[]; categorias: Cat[]; contas: Conta[] };
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "naoconc" | "semcat">("naoconc");
  const [sel, setSel] = useState<string | null>(null);
  const [autoMsg, setAutoMsg] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [nl, setNl] = useState({ contaId: "", data: new Date().toISOString().slice(0, 10), tipo: "debito", valor: "", descricao: "", categoriaId: "" });
  const [savingNl, setSavingNl] = useState(false);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataBR = (s?: string | null) => (s ? new Date(s + (s.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "—");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/conciliar?company=${companyId}`)
      .then((r) => r.json()).then((d: Data) => { setData(d); })
      .finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data && !nl.contaId && data.contas[0]) setNl((x) => ({ ...x, contaId: data.contas[0].id })); }, [data]); // eslint-disable-line

  async function act(transactionId: string, body: any) {
    await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId, ...body }) });
    load();
  }
  async function setCategoria(txId: string, categoriaId: string) {
    await fetch(`/api/finance/lancamentos?company=${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txId, categoriaId: categoriaId || null }) });
    load();
  }
  async function autoConc() {
    setAutoMsg("Conciliando…");
    const r = await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "auto", companyId }) });
    const d = await r.json();
    setAutoMsg(r.ok ? `${d.auto} conciliado(s) automaticamente · ${d.restantes} restante(s).` : (d.error || "Erro."));
    load();
  }
  async function lancarManual() {
    if (!nl.contaId || !nl.valor || !nl.descricao.trim()) { setAutoMsg("Preencha conta, valor e descrição."); return; }
    setSavingNl(true);
    const r = await fetch(`/api/finance/contas/${nl.contaId}/lancar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: nl.data, tipo: nl.tipo, valor: Number(nl.valor), descricao: nl.descricao, categoriaId: nl.categoriaId || null }) });
    const d = await r.json(); setSavingNl(false);
    if (!r.ok) { setAutoMsg(d.error || "Erro ao lançar."); return; }
    setAutoMsg("Lançamento manual criado.");
    setNl((x) => ({ ...x, valor: "", descricao: "", categoriaId: "" })); setShowManual(false); load();
  }

  const all = data?.lancamentos || [];
  const lancs = all.filter((l) => filtro === "todos" ? true : filtro === "naoconc" ? !l.conciliado : !l.categoria);
  const nConc = all.filter((l) => !l.conciliado).length;
  const nSemCat = all.filter((l) => !l.categoria).length;
  const atual = lancs.find((l) => l.id === sel) || null;
  useEffect(() => { if (lancs.length && !lancs.some((l) => l.id === sel)) setSel(lancs[0].id); }, [filtro, all]); // eslint-disable-line

  const statusPill = (st: string) => {
    const ok = st === "paga" || st === "pago"; const venc = st === "vencida";
    return <span style={{ fontSize: 10.5, fontWeight: 700, color: ok ? "#0f6b50" : venc ? "#a8332c" : "#b5781f", background: ok ? "#d7ebe2" : venc ? "#f3dcd8" : "#f6e7cd", borderRadius: 999, padding: "1px 8px" }}>{st}</span>;
  };
  const catSel = (txId: string, value: string | null) => (
    <select className="fx-input" style={{ fontSize: 12, maxWidth: 230 }} value={value ? "keep" : ""} onChange={(e) => { if (e.target.value && e.target.value !== "keep") setCategoria(txId, e.target.value); }}>
      <option value="">{value || "categoria…"}</option>
      {(data?.categorias || []).map((c) => <option key={c.id} value={c.id}>{c.grupo} › {c.nome}</option>)}
    </select>
  );

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 12, maxWidth: 840 }}><b>Extrato / Conciliação.</b> Tudo que entrou e saiu das contas de caixa. Cada linha mostra se está <b>conciliada</b> (identificada) ou não. Selecione pra ver detalhes e casar com a conta a receber/pagar, ou lance algo que o banco não trouxe.</div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {([["naoconc", `Não conciliados (${nConc})`], ["semcat", `Sem categoria (${nSemCat})`], ["todos", `Todos (${all.length})`]] as const).map(([k, l]) => (
          <button key={k} className="fx-btn" onClick={() => setFiltro(k)} style={{ fontSize: 12.5, fontWeight: filtro === k ? 700 : 400, background: filtro === k ? "var(--setor, rgba(146,80,172,.12))" : undefined, color: filtro === k ? "var(--txt)" : "var(--txt-soft)" }}>{l}</button>
        ))}
        <button className="fx-btn" onClick={() => setShowManual((v) => !v)} style={{ marginLeft: "auto", fontSize: 12.5 }}>+ Lançamento manual</button>
        <button className="fx-btn fx-btn-primary" onClick={autoConc} style={{ fontSize: 12.5 }}>Conciliar automático</button>
        <button className="fx-btn" onClick={load} style={{ fontSize: 12.5 }}>Recarregar</button>
      </div>
      {autoMsg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "8px 12px", fontSize: 12.5, marginBottom: 12 }}>{autoMsg}</div>}

      {showManual && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "14px 16px", marginBottom: 14, maxWidth: 820 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Novo lançamento manual</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ fontSize: 11.5, color: "var(--txt-soft)" }}>Conta<br /><select className="fx-input" value={nl.contaId} onChange={(e) => setNl({ ...nl, contaId: e.target.value })}>{(data?.contas || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label style={{ fontSize: 11.5, color: "var(--txt-soft)" }}>Tipo<br /><select className="fx-input" value={nl.tipo} onChange={(e) => setNl({ ...nl, tipo: e.target.value })}><option value="debito">Saída</option><option value="credito">Entrada</option></select></label>
            <label style={{ fontSize: 11.5, color: "var(--txt-soft)" }}>Data<br /><input className="fx-input" type="date" value={nl.data} onChange={(e) => setNl({ ...nl, data: e.target.value })} /></label>
            <label style={{ fontSize: 11.5, color: "var(--txt-soft)" }}>Valor (R$)<br /><input className="fx-input" type="number" value={nl.valor} onChange={(e) => setNl({ ...nl, valor: e.target.value })} placeholder="0,00" style={{ maxWidth: 110 }} /></label>
            <label style={{ fontSize: 11.5, color: "var(--txt-soft)", flex: 1, minWidth: 180 }}>Descrição<br /><input className="fx-input" style={{ width: "100%" }} value={nl.descricao} onChange={(e) => setNl({ ...nl, descricao: e.target.value })} placeholder="ex.: Milena (PF Giancarlo)" /></label>
            <label style={{ fontSize: 11.5, color: "var(--txt-soft)" }}>Categoria<br /><select className="fx-input" value={nl.categoriaId} onChange={(e) => setNl({ ...nl, categoriaId: e.target.value })}><option value="">—</option>{(data?.categorias || []).map((c) => <option key={c.id} value={c.id}>{c.grupo} › {c.nome}</option>)}</select></label>
            <button className="fx-btn fx-btn-primary" disabled={savingNl} onClick={lancarManual}>{savingNl ? "…" : "Lançar"}</button>
          </div>
        </div>
      )}

      {loading && !data && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 320, display: "flex", flexDirection: "column", gap: 6, maxHeight: "68vh", overflowY: "auto", paddingRight: 4 }}>
          {data && lancs.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nada aqui. 🎉</p>}
          {lancs.map((l) => {
            const ativo = l.id === sel;
            return (
              <button key={l.id} onClick={() => setSel(l.id)} style={{ textAlign: "left", border: "1px solid var(--line)", borderLeft: `3px solid ${l.conciliado ? "#1f9d57" : "#d68910"}`, borderRadius: "var(--r-card)", padding: "9px 12px", background: ativo ? "var(--setor, rgba(146,80,172,.10))" : "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span title={l.conciliado ? "conciliado" : "não conciliado"} style={{ width: 8, height: 8, borderRadius: "50%", background: l.conciliado ? "#1f9d57" : "#d68910", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.8, fontWeight: ativo ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dataBR(l.data)} · {l.conta} · {l.categoria || "sem categoria"}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 12.8, color: l.tipo === "credito" ? "#0f6b50" : "#a8332c", whiteSpace: "nowrap" }}>{l.tipo === "credito" ? "+" : "−"}{money(l.valor)}</div>
              </button>
            );
          })}
        </div>

        <div style={{ flex: "1 1 380px", minWidth: 320, position: "sticky", top: 8 }}>
          {!atual ? (
            <div style={{ border: "1px dashed var(--line)", borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center", color: "var(--txt-faint)", fontSize: 13 }}>Selecione um lançamento à esquerda.</div>
          ) : (
            <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Lançamento</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{atual.descricao}</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, fontSize: 12.5, color: "var(--txt-soft)" }}>
                <span>{dataBR(atual.data)}</span><span>{atual.conta}</span>
                <span style={{ fontWeight: 700, color: atual.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{atual.tipo === "credito" ? "Entrada" : "Saída"} · {atual.tipo === "credito" ? "+" : "−"}{money(atual.valor)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>Categoria:</span>{catSel(atual.id, atual.categoria)}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {atual.conciliado
                  ? <><span style={{ fontSize: 11.5, fontWeight: 700, color: "#0f6b50", background: "#d7ebe2", borderRadius: 999, padding: "3px 10px" }}>🟢 conciliado</span><button className="fx-btn" style={{ fontSize: 12 }} onClick={() => act(atual.id, { action: "desconciliar" })}>Desfazer</button></>
                  : <><span style={{ fontSize: 11.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "3px 10px" }}>⚪ não conciliado</span><button className="fx-btn" style={{ fontSize: 12 }} onClick={() => act(atual.id, { conciliado: true })}>Marcar conciliado (sem título)</button></>}
              </div>

              <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".06em", margin: "16px 0 8px", borderTop: "1px solid var(--line)", paddingTop: 12 }}>{atual.tipo === "credito" ? "Contas a receber que casam" : "Contas a pagar que casam"} ({atual.sugestoes.length})</div>
              {atual.sugestoes.length === 0 && <p style={{ fontSize: 12.5, color: "var(--txt-faint)", margin: 0 }}>Nenhuma com esse valor. Se for transferência/CDB/tarifa, marque como conciliado sem título acima.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {atual.sugestoes.map((sg) => (
                  <div key={sg.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--bg)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{sg.descricao || (sg.tipo === "pagar" ? "Conta a pagar" : "Recebível")}</span>{statusPill(sg.status)}</div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontSize: 12, color: "var(--txt-soft)" }}>
                      {sg.contraparte ? <span>{sg.tipo === "pagar" ? "Credor/Área" : "Cliente"}: <b style={{ color: "var(--txt)" }}>{sg.contraparte}</b></span> : null}
                      <span>Venc.: {dataBR(sg.vencimento)}</span>{sg.metodo ? <span>{sg.metodo}</span> : null}<span style={{ fontWeight: 700 }}>{money(sg.valor)}</span>
                    </div>
                    <div style={{ marginTop: 8 }}><button className="fx-btn fx-btn-primary" style={{ fontSize: 12 }} onClick={() => act(atual.id, { requestId: sg.id, conciliado: true })}>Conciliar com este</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
