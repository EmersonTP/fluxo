"use client";
import { useCallback, useEffect, useState } from "react";

type Pac = { clienteId: string; nome: string; marcado: boolean; presente: boolean; motivo: string; observacao: string };
const MOTIVOS = ["Trabalho/agenda", "Saúde", "Desmotivação", "Esqueceu", "Recaída", "Viagem", "Família", "Sem transporte", "Outro"];

export default function AcompanhamentoPage() {
  const [companyId, setCompanyId] = useState("");
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [sel, setSel] = useState<string>("");
  const [pacientes, setPacientes] = useState<Pac[]>([]);
  const [faltas, setFaltas] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let c = "";
    try { c = localStorage.getItem("fx:company") || ""; } catch {}
    if (c) { setCompanyId(c); return; }
    fetch("/api/companies").then((r) => r.json()).then((d) => { const id = (d.companies || [])[0]?.id || ""; setCompanyId(id); }).catch(() => {});
  }, []);

  const loadSessoes = useCallback(() => {
    if (!companyId) return;
    fetch(`/api/acompanhamento/sessoes?company=${companyId}`).then((r) => r.json()).then((d) => {
      setSessoes(d.sessoes || []);
      if (!sel && d.sessoes?.[0]) setSel(d.sessoes[0].id);
    });
    fetch(`/api/acompanhamento/faltas?company=${companyId}`).then((r) => r.json()).then(setFaltas);
  }, [companyId, sel]);
  useEffect(() => { loadSessoes(); }, [loadSessoes]);

  const loadSessao = useCallback((id: string) => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/acompanhamento/sessoes/${id}`).then((r) => r.json()).then((d) => setPacientes(d.pacientes || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (sel) loadSessao(sel); }, [sel, loadSessao]);

  async function novaSessao() {
    setMsg("");
    const r = await fetch("/api/acompanhamento/sessoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
    const d = await r.json();
    if (d.sessao?.id) { setSel(d.sessao.id); loadSessoes(); setMsg(d.jaExistia ? "Já existia uma sessão hoje — abrindo ela." : "Sessão de hoje criada."); }
  }

  async function marcar(p: Pac, presente: boolean, patch: Partial<Pac> = {}) {
    const next = { ...p, marcado: true, presente, ...patch };
    setPacientes((arr) => arr.map((x) => (x.clienteId === p.clienteId ? next : x)));
    await fetch("/api/acompanhamento/presenca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessaoId: sel, clienteId: p.clienteId, presente, motivo: next.motivo, observacao: next.observacao }) });
    fetch(`/api/acompanhamento/faltas?company=${companyId}`).then((r) => r.json()).then(setFaltas);
  }

  const presentes = pacientes.filter((p) => p.marcado && p.presente).length;
  const faltaram = pacientes.filter((p) => p.marcado && !p.presente).length;
  const pend = pacientes.filter((p) => !p.marcado).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Acompanhamento</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 700 }}>Sessão em grupo — check-in</div>
          <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 2 }}>Marque quem foi e quem faltou (e por quê). A lista são os pacientes cadastrados.</div>
        </div>
        <select className="fx-input" value={sel} onChange={(e) => setSel(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">— escolher sessão —</option>
          {sessoes.map((s) => <option key={s.id} value={s.id}>{new Date(s.data + "T12:00:00").toLocaleDateString("pt-BR")} · {s.presentes}✓ {s.faltas}✗</option>)}
        </select>
        <button className="fx-btn fx-btn-primary" onClick={novaSessao}>+ Sessão de hoje</button>
      </div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "9px 13px", fontSize: 13, marginBottom: 14, maxWidth: 560 }}>{msg}</div>}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* check-in */}
        <div style={{ flex: 1, minWidth: 360 }}>
          {!sel && <p style={{ color: "var(--txt-faint)" }}>Crie a sessão de hoje ou escolha uma sessão acima.</p>}
          {sel && (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 12.5, color: "var(--txt-soft)" }}>
                <span>✓ {presentes} presentes</span><span>✗ {faltaram} faltas</span><span style={{ color: "var(--txt-faint)" }}>• {pend} a marcar</span>
              </div>
              {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
              {!loading && pacientes.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum paciente cadastrado ainda. Cadastre em Finanças → Contas a Receber → Memberships.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pacientes.map((p) => (
                  <div key={p.clienteId} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "10px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{p.nome}</span>
                      <button onClick={() => marcar(p, true)} className="fx-btn" style={{ fontSize: 12.5, background: p.marcado && p.presente ? "#d7ebe2" : "var(--surface)", color: p.marcado && p.presente ? "#0f6b50" : "var(--txt-soft)", fontWeight: p.marcado && p.presente ? 700 : 400 }}>Presente</button>
                      <button onClick={() => marcar(p, false)} className="fx-btn" style={{ fontSize: 12.5, background: p.marcado && !p.presente ? "#f3dcd8" : "var(--surface)", color: p.marcado && !p.presente ? "#a8332c" : "var(--txt-soft)", fontWeight: p.marcado && !p.presente ? 700 : 400 }}>Faltou</button>
                    </div>
                    {p.marcado && !p.presente && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <select className="fx-input" value={p.motivo} onChange={(e) => marcar(p, false, { motivo: e.target.value })} style={{ maxWidth: 190, fontSize: 12.5 }}>
                          <option value="">motivo da falta…</option>
                          {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input className="fx-input" defaultValue={p.observacao} onBlur={(e) => marcar(p, false, { observacao: e.target.value })} placeholder="observação (opcional)" style={{ flex: 1, minWidth: 160, fontSize: 12.5 }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* quem está faltando */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Quem está faltando</div>
          <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginBottom: 8 }}>Últimas {faltas?.sessoes || 0} sessões — pra você cobrar no follow-up.</div>
          {(!faltas || faltas.pacientes?.length === 0) && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Ninguém com faltas. 🎉</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(faltas?.pacientes || []).map((a: any) => (
              <div key={a.clienteId} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "9px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{a.nome}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: a.faltas >= 3 ? "#a8332c" : "#b5781f" }}>{a.faltas} falta{a.faltas > 1 ? "s" : ""}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginTop: 2 }}>{a.presencas} presença(s){a.ultimaPresenca ? ` · última ${new Date(a.ultimaPresenca + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
