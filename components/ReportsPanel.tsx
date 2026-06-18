"use client";

import { useEffect, useState } from "react";

type Report = {
  total: number;
  concluidas: number;
  abertas: number;
  atrasadas: number;
  concluidas7d: number;
  porPrioridade: Record<string, number>;
  porStatus: { name: string; count: number; color: string }[];
  porResponsavel: { name: string; color: string; abertas: number }[];
};

const PRIO_LABEL: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgente", color: "#e5484d" },
  high: { label: "Alta", color: "#ff7e59" },
  normal: { label: "Normal", color: "#3b82f6" },
  low: { label: "Baixa", color: "#9aa0a6" },
  none: { label: "Sem prioridade", color: "#c7c7c7" },
};

export default function ReportsPanel() {
  const [r, setR] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((x) => x.json())
      .then(setR)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Visão geral</div>
          <div className="fx-title">Relatórios</div>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 26px 48px" }}>
        {loading && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {r && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
              <Kpi label="Total de tarefas" value={r.total} />
              <Kpi label="Abertas" value={r.abertas} color="var(--roxo)" />
              <Kpi label="Concluídas" value={r.concluidas} color="var(--sage)" />
              <Kpi label="Atrasadas" value={r.atrasadas} color="var(--coral-deep)" />
              <Kpi label="Concluídas (7 dias)" value={r.concluidas7d} color="var(--sage)" />
            </div>

            <Card title="Por status">
              <Bars items={r.porStatus.map((s) => ({ label: s.name, value: s.count, color: s.color }))} total={r.total} />
            </Card>

            <Card title="Por prioridade">
              <Bars
                items={Object.entries(r.porPrioridade)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => ({ label: PRIO_LABEL[k]?.label || k, value: v, color: PRIO_LABEL[k]?.color || "#999" }))}
                total={r.total}
              />
            </Card>

            <Card title="Tarefas abertas por responsável">
              {r.porResponsavel.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--txt-faint)", margin: 0 }}>Nenhuma tarefa aberta atribuída.</p>
              ) : (
                <Bars
                  items={r.porResponsavel.map((p) => ({ label: p.name, value: p.abertas, color: p.color }))}
                  total={Math.max(...r.porResponsavel.map((p) => p.abertas), 1)}
                  avatar
                />
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 18px" }}>
      <div className="serif" style={{ fontSize: 30, fontWeight: 600, color: color || "var(--txt)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--txt-soft)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "18px 20px", marginBottom: 18 }}>
      <div className="serif" style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Bars({ items, total, avatar }: { items: { label: string; value: number; color: string }[]; total: number; avatar?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {avatar && (
            <span className="fx-avatar" style={{ width: 22, height: 22, background: it.color, flexShrink: 0 }}>{it.label.charAt(0).toUpperCase()}</span>
          )}
          <span style={{ width: 130, fontSize: 12.5, color: "var(--txt-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{it.label}</span>
          <div style={{ flex: 1, height: 18, background: "var(--col)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, (it.value / total) * 100)}%`, height: "100%", background: it.color, borderRadius: 6 }} />
          </div>
          <span style={{ width: 34, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--txt)" }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}
