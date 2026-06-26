// Recibo de atendimento psicológico — para o paciente solicitar reembolso ao convênio.
// Traz dados do paciente (tomador) + valor + período, e área pro CARIMBO + assinatura da profissional (CRP).
export type ReciboData = {
  paciente: string;
  cpf?: string | null;
  valor?: number | null;        // em reais
  data?: string | null;         // dd/mm/aaaa do atendimento/pagamento
  competencia?: string | null;  // ex.: "junho/2026" ou "4 sessões de junho/2026"
  profissional?: string | null; // opcional: nome impresso
  crp?: string | null;          // opcional: CRP impresso
  cidade?: string | null;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const money = (v?: number | null) => (v == null ? "R$ ____________" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
function extenso(v?: number | null) { return v == null ? "" : ` (${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`; }

export function reciboHtml(d: ReciboData): string {
  const b = "____________";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Recibo — Atendimento Psicológico — ${esc(d.paciente)}</title>
<style>
  @page { size: A4; margin: 24mm 22mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; font-size: 12pt; line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 28px; }
  h1 { font-size: 15pt; text-align: center; letter-spacing: 2px; margin: 0 0 2px; }
  .org { text-align: center; color: #555; font-size: 10.5pt; margin-bottom: 26px; }
  .valor { text-align: right; font-size: 14pt; font-weight: bold; border: 1px solid #333; display: inline-block; padding: 6px 16px; border-radius: 6px; }
  .corpo { margin: 24px 0; text-align: justify; }
  .ass { margin-top: 56px; text-align: center; }
  .linha { border-top: 1px solid #333; width: 320px; margin: 0 auto; padding-top: 6px; font-size: 10.5pt; }
  .carimbo { margin-top: 14px; font-size: 9.5pt; color: #777; }
  .nota { margin-top: 40px; font-size: 9pt; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; }
  .noprint { background: #eef; border: 1px solid #99c; border-radius: 8px; padding: 10px 14px; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 18px; }
  @media print { .noprint { display: none; } body { padding: 0; } }
</style></head><body>
<div class="noprint"><b>Como usar:</b> Imprimir (Ctrl/Cmd+P) → Salvar como PDF. A profissional <b>assina e carimba</b> no espaço indicado (carimbo com nome + CRP). O paciente apresenta este recibo + o comprovante de pagamento ao convênio para reembolso.</div>

<h1>RECIBO</h1>
<div class="org">Atendimento Psicológico — Emerson Saúde</div>

<div style="text-align:right; margin-bottom:18px"><span class="valor">${money(d.valor)}</span></div>

<div class="corpo">
  Recebi de <b>${esc(d.paciente) || b}</b>, inscrito(a) no CPF nº <b>${esc(d.cpf) || b}</b>,
  a importância de <b>${money(d.valor)}${extenso(d.valor)}</b>,
  referente a <b>atendimento psicológico (psicoterapia)</b>${d.competencia ? ` — ${esc(d.competencia)}` : (d.data ? ` realizado em ${esc(d.data)}` : "")}.
  <br><br>
  Para clareza e fins de comprovação junto ao convênio/plano de saúde, firmo o presente recibo.
</div>

<p>${esc(d.cidade) || b}, ${esc(d.data) || `______ de ________________ de ______`}.</p>

<div class="ass">
  <div class="linha">${esc(d.profissional) || "Assinatura e carimbo do(a) profissional"}</div>
  <div class="carimbo">${d.crp ? `CRP ${esc(d.crp)}` : "Carimbo profissional (nome + CRP)"}</div>
</div>

<div class="nota">
  Documento emitido para fins de reembolso. A psicoterapia foi prestada pela profissional responsável (registro no CRP).
  As exigências de reembolso podem variar conforme o convênio.
</div>
</body></html>`;
}
