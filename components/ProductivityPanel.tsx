"use client";

import { useEffect, useState } from "react";

type Person = {
  id: string;
  name: string;
  color: string;
  concluidas: number;
  abertas: number;
  atrasadas: number;
  pctNoPrazo: number | null;
};

const PERIODS: [string, string][] = [
  ["week", "Última semana"],
  ["month4", "Últimas 4 semanas"],
  ["current", "Mês atual"],
  ["all", "Tudo"],
];

export default function ProductivityPanel() {
  const [period, setPeriod] = useState("week");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/productivity?period=${period}`)
      .then((r) => r.json())
      .then((d) => setPeople(d.people || []))
      .finally(() => setLoading(false));
  }, [period]);

  const maxConcl = Math.max(1, ...people.map((p) => p.concluidas));
  const totalConcl = people.reduce((s, p) => s + p.concluidas, 0);

  function pctColor(pct: number | null) {
    if (pct === null) return "var(--txt-faint)";
    if (pct >= 80) return "var(--sage)";
    if (pct >= 50) return "var(--coral)";
    return "var(--coral-deep)";
  }

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Equipe</div>
          <div className="fx-title">Produtividade</div>
        </div>
        <select className="fx-select" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ marginLeft: "auto" }}>
          {PERIODS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 48px" }}>
        <p style={{ fontSize: 12.5, color: "var(--txt-faint)", marginBottom: 16 }}>
          {totalConcl} tarefa(s) concluída(s) no período · {people.length} pessoa(s). Mede volume e pontualidade — não o tamanho de cada tarefa.
        </p>

        {loading && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {!loading && people.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Sem dados de pessoas neste período.</p>}

        {!loading && people.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px 90px 90px 90px", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid var(--line)", background: "var(--col)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-faint)" }}>
              <span>Pessoa</span>
              <span>Concluídas</span>
              <span style={{ textAlign: "center" }}>No prazo</span>
              <span style={{ textAlign: "center" }}>Abertas</span>
              <span style={{ textAlign: "center" }}>Atrasadas</span>
            </div>
            {people.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px 90px 90px 90px", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <span className="fx-avatar" style={{ width: 26, height: 26, background: p.color, flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</span>
                  <span style={{ fontSize: 13.5, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, height: 16, background: "var(--col)", borderRadius: 5, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${Math.max(4, (p.concluidas / maxConcl) * 100)}%`, height: "100%", background: "var(--roxo)" }} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, width: 24, textAlign: "right" }}>{p.concluidas}</span>
                </span>
                <span style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: pctColor(p.pctNoPrazo) }}>
                  {p.pctNoPrazo === null ? "—" : `${p.pctNoPrazo}%`}
                </span>
                <span style={{ textAlign: "center", fontSize: 13, color: "var(--txt-soft)" }}>{p.abertas}</span>
                <span style={{ textAlign: "center", fontSize: 13, fontWeight: p.atrasadas > 0 ? 700 : 400, color: p.atrasadas > 0 ? "var(--coral-deep)" : "var(--txt-soft)" }}>{p.atrasadas}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
