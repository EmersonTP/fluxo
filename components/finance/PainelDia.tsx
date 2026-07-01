"use client";
import { useEffect, useState } from "react";

type P = {
  data: string; caixa: number; ultimoSync: string | null;
  entrouHoje: number; saiuHoje: number;
  aReceberAberto: number; vencidoValor: number; vencidoQtd: number;
  recebidoMes: number; mrr: number;
  aPagarPend: number; aguardandoPagamento: number;
  conciliar: { aCasar: number; pagosSemLastro: number }; semCategoria: number;
};

export function PainelDia({ companyId }: { companyId: string }) {
  const [d, setD] = useState<P | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/painel-dia?company=${companyId}`).then((r) => r.json()).then(setD).finally(() => setLoading(false));
  }, [companyId]);

  const brl = (v: number) => "R$ " + Math.round(v || 0).toLocaleString("pt-BR");
  if (loading) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;
  if (!d || (d as any).error) return <p style={{ color: "var(--coral-deep)" }}>{(d as any)?.error || "Erro ao carregar."}</p>;

  const hoje = new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const Card = ({ label, valor, cor, hint }: { label: string; valor: string; cor?: string; hint?: string }) => (
    <div style={{ flex: "1 1 200px", minWidth: 180, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div className="serif" style={{ fontSize: 26, fontWeight: 600, color: cor || "var(--txt)", marginTop: 2 }}>{valor}</div>
      {hint && <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{hint}</div>}
    </div>
  );
  const temPendencia = d.conciliar.aCasar + d.conciliar.pagosSemLastro + d.semCategoria + d.aguardandoPagamento > 0;

  return (
    <>
      <div className="fx-topbar"><div><div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Painel do dia</div><div className="fx-title" style={{ textTransform: "capitalize" }}>{hoje}</div></div></div>
      <div className="fx-accent" />
      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 48px" }}>

        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Caixa & dia</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <Card label="Saldo em caixa" valor={brl(d.caixa)} cor="var(--roxo, #7a3fa0)" hint={d.ultimoSync ? "sync " + new Date(d.ultimoSync).toLocaleString("pt-BR") : "—"} />
          <Card label="Entrou hoje" valor={brl(d.entrouHoje)} cor="#0f6b50" />
          <Card label="Saiu hoje" valor={brl(d.saiuHoje)} cor="#a8332c" />
          <Card label="Recebido no mês" valor={brl(d.recebidoMes)} cor="#0f6b50" />
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>A receber</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <Card label="A receber (em aberto)" valor={brl(d.aReceberAberto)} />
          <Card label="Vencido" valor={brl(d.vencidoValor)} cor={d.vencidoValor ? "#a8332c" : "#0f6b50"} hint={d.vencidoQtd + " paciente(s)"} />
          <Card label="MRR (recorrente/mês)" valor={brl(d.mrr)} cor="#0f6b50" />
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>A pagar & pendências</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <Card label="Solicitações em aberto" valor={String(d.aPagarPend)} cor={d.aPagarPend ? "#274b6d" : "#0f6b50"} />
          <Card label="Aguardando pagamento" valor={String(d.aguardandoPagamento)} cor={d.aguardandoPagamento ? "#b5781f" : "#0f6b50"} hint="conferidas, prontas p/ pagar" />
          <Card label="Recebimentos a conciliar" valor={String(d.conciliar.aCasar)} cor={d.conciliar.aCasar ? "#b5781f" : "#0f6b50"} />
          <Card label="Pagos sem lastro" valor={String(d.conciliar.pagosSemLastro)} cor={d.conciliar.pagosSemLastro ? "#a8332c" : "#0f6b50"} />
          <Card label="Sem categoria" valor={String(d.semCategoria)} cor={d.semCategoria ? "#b5781f" : "#0f6b50"} />
        </div>

        <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: "var(--r-card)", border: "1px solid " + (temPendencia ? "#e4b8b1" : "#9fe1cb"), background: temPendencia ? "#f3dcd8" : "#d7ebe2", color: temPendencia ? "#a8332c" : "#0c5a44", fontWeight: 600, maxWidth: 620 }}>
          {temPendencia
            ? "Há pendências pra hoje: confira 'A pagar & pendências' acima."
            : "✓ Nada pendente hoje — conciliação em dia, sem pagamentos travados."}
        </div>
      </div>
    </>
  );
}
