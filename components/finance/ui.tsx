"use client";
import { ReactNode } from "react";

/* Helpers de apresentação compartilhados do módulo financeiro. */
export function Drawer({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.32)", zIndex: 60, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: wide ? 560 : 460, maxWidth: "94vw", background: "var(--bg)", height: "100%", overflowY: "auto", padding: "20px 22px", boxShadow: "-12px 0 40px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--txt-faint)" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Row({ children }: { children: ReactNode }) { return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>; }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <div style={{ flex: 1, minWidth: 150, marginBottom: 10 }}><div style={{ fontSize: 12, color: "var(--txt-soft)", marginBottom: 4 }}>{label}</div>{children}</div>; }
export function Grid2({ children }: { children: ReactNode }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", margin: "6px 0 12px" }}>{children}</div>; }
export function Info({ label, children }: { label: string; children: ReactNode }) { return <div style={{ padding: "5px 0", borderBottom: "1px solid var(--line)" }}><div style={{ fontSize: 11, color: "var(--txt-faint)" }}>{label}</div><div style={{ fontSize: 13.5 }}>{children}</div></div>; }
export function Section({ title, children }: { title: string; children: ReactNode }) { return <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}><div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 10 }}>{title}</div>{children}</div>; }
export function Block({ title, children }: { title: string; children: ReactNode }) { return <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16 }}><div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{title}</div>{children}</div>; }
export function Chip({ children, onX }: { children: ReactNode; onX: () => void }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--col)", borderRadius: 999, padding: "3px 6px 3px 11px", fontSize: 12.5 }}>{children}<button onClick={onX} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 14 }}>×</button></span>; }

export function Metric({ label, value, tone }: { label: string; value: string; tone?: "alert" }) {
  const alert = tone === "alert";
  return (
    <div style={{ background: alert ? "#f3dcd8" : "var(--col)", borderRadius: "var(--r-card)", padding: "12px 18px", minWidth: 130 }}>
      <div style={{ fontSize: 12, color: alert ? "#a8332c" : "var(--txt-faint)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2, color: alert ? "#a8332c" : "var(--txt)" }}>{value}</div>
    </div>
  );
}

export function TabHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Alerta({ tone, txt, acao, onClick }: { tone: "critico" | "atencao"; txt: string; acao: string; onClick: () => void }) {
  const c = tone === "critico" ? { bg: "#f3dcd8", fg: "#a8332c", dot: "#c0392b" } : { bg: "#f6e7cd", fg: "#b5781f", dot: "#d68910" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: c.bg, borderRadius: "var(--r-card)", padding: "9px 14px" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: c.fg }}>{txt}</span>
      <button onClick={onClick} style={{ background: "none", border: "none", color: c.fg, fontWeight: 700, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{acao} →</button>
    </div>
  );
}

export function BRLcents(c: number) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
