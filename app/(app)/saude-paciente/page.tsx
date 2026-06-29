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
  const [tab, setTab] = useState<"saude" | "checkin">("saude");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "14px 28px 0", borderBottom: "1px solid var(--line)" }}>
        {([["saude", "Saúde"], ["checkin", "Check-in da sessão"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: tab === k ? "2px solid var(--roxo)" : "2px solid transparent", padding: "8px 10px", fontWeight: tab === k ? 700 : 500, color: tab === k ? "var(--txt)" : "var(--txt-soft)", cursor: "pointer", fontSize: 14 }}>{l}</button>
        ))}
      </div>
      {tab === "saude" ? <SaudeView /> : <CheckinSessaoView />}
    </div>
  );
}

function SaudeView() {
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--line)", borderLeft: `4px solid ${COR[p.score as keyof typeof COR]}`, borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 16px", flexWrap: "wrap" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: COR[p.score as keyof typeof COR], flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 14, minWidth: 160, flex: 1 }}>{p.nome}</span>
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
    </div>
  );
}
