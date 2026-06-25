"use client";

export function Esteira({ status }: { status: string }) {
  const stages = ["solicitada", "aprovada_gestor", "conferida", "paga"];
  const labels = ["Solicitada", "Gestor", "Financeiro", "Pago"];
  const failed = status === "recusada" || status === "cancelada";
  const idx = stages.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0 14px" }}>
      {labels.map((l, i) => {
        const done = !failed && idx >= i;
        return (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: done ? "var(--sage)" : "var(--col)", color: done ? "#fff" : "var(--txt-faint)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{done ? "✓" : i + 1}</span>
              <span style={{ fontSize: 12, color: done ? "var(--txt)" : "var(--txt-faint)", fontWeight: done ? 600 : 400 }}>{l}</span>
            </div>
            {i < labels.length - 1 && <div style={{ flex: 1, height: 2, background: !failed && idx > i ? "var(--sage)" : "var(--line)" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Credores ---------- */
