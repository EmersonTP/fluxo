"use client";
import { useState, useEffect, useCallback } from "react";

type Lanc = { id: string; data: string; descricao: string; valor: number; tipo: string; conta?: string; categoria?: string | null; conciliado?: boolean; requestId?: string | null };
type Rec = { id: string; descricao: string; valor: number; status: string; cliente?: string | null; vencimento?: string | null; conciliado?: boolean };

export function AConciliarTab({ companyId }: { companyId: string }) {
  const [aCasar, setACasar] = useState<Lanc[]>([]);
  const [semLastro, setSemLastro] = useState<Rec[]>([]);
  const [titulos, setTitulos] = useState<Rec[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const brl = (v: number) => "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/finance/conciliar?company=${companyId}`).then((r) => r.json()),
      fetch(`/api/finance/receber?company=${companyId}`).then((r) => r.json()),
    ]).then(([conc, rec]: any[]) => {
      const lanc: Lanc[] = conc.lancamentos || [];
      const recs: Rec[] = rec.recebiveis || [];
      // recebimentos (créditos) de receita ainda sem dono (sem título amarrado)
      setACasar(lanc.filter((t) => t.tipo === "credito" && !t.requestId && /receita|membership|sem categoria/i.test((t.categoria || "sem categoria"))));
      // títulos marcados pagos mas sem lastro no extrato
      setSemLastro(recs.filter((r) => r.status === "paga" && !r.conciliado));
      // títulos em aberto (candidatos pra casar)
      setTitulos(recs.filter((r) => r.status === "pendente" || r.status === "vencida"));
    }).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function casar(creditId: string) {
    const recId = sel[creditId];
    if (!recId) { setMsg("Escolha o título do paciente antes de casar."); return; }
    setBusy(creditId); setMsg("");
    const r = await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: creditId, requestId: recId }) });
    setBusy("");
    if (r.ok) { setMsg("✓ Casado."); load(); } else { const d = await r.json().catch(() => ({})); setMsg(d.error || "Erro ao casar."); }
  }
  async function marcarSemTitulo(creditId: string) {
    setBusy(creditId);
    await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: creditId }) }).catch(() => {});
    setBusy(""); load();
  }

  const titOptions = [...titulos].sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
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
            {aCasar.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
                <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{(t.descricao || "Recebimento").replace("PIX RECEBIDO - Cp :", "").replace(/^\d+-/, "")}</div>
                  <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{dt(t.data)} · {t.conta || "—"} · {t.categoria || "sem categoria"}</div>
                </div>
                <b style={{ color: "#0f6b50", minWidth: 90, textAlign: "right" }}>{brl(t.valor)}</b>
                <select className="fx-input" style={{ flex: "0 0 230px", maxWidth: 230, fontSize: 12.5 }} value={sel[t.id] || ""} onChange={(e) => setSel({ ...sel, [t.id]: e.target.value })}>
                  <option value="">— título do paciente —</option>
                  {titOptions.map((r) => <option key={r.id} value={r.id}>{r.cliente || "—"} · {brl(r.valor)}{r.vencimento ? " · vence " + dt(r.vencimento) : ""}</option>)}
                </select>
                <button className="fx-btn fx-btn-primary" style={{ fontSize: 12.5 }} disabled={busy === t.id || !sel[t.id]} onClick={() => casar(t.id)}>{busy === t.id ? "…" : "Casar"}</button>
                <button className="fx-btn" style={{ fontSize: 11.5, color: "var(--txt-faint)" }} disabled={busy === t.id} onClick={() => marcarSemTitulo(t.id)} title="Não é mensalidade de paciente (ex.: avulso, outra receita)">não é de paciente</button>
              </div>
            ))}
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
                <b style={{ minWidth: 84, textAlign: "right" }}>{brl(r.valor)}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
