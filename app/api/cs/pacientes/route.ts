import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

// Painel de Saúde do Paciente (CS): por paciente, junta presença (sessões) + pagamento (recebíveis)
// num "health score" verde/amarelo/vermelho com flags de risco. Alimentado pelo que o Nicolas registra.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ pacientes: [], resumo: null });

  const now = new Date();
  const em7dias = new Date(now.getTime() + 7 * 864e5);

  const clientes: any[] = await prisma.cliente.findMany({
    where: { companyId, ativo: true },
    select: {
      id: true, nome: true, consentimentoLGPD: true,
      assinaturas: { select: { status: true } },
      recebiveis: { where: { status: { in: ["pendente", "vencida"] } }, select: { status: true, vencimento: true } },
      presencasSessao: { where: { marcado: true }, select: { presente: true, sessao: { select: { data: true } } } },
    },
    orderBy: { nome: "asc" },
  });

  const pacientes = clientes.map((c) => {
    // presença — últimas 8 sessões marcadas
    const pres = [...c.presencasSessao].sort((a, b) => +new Date(b.sessao.data) - +new Date(a.sessao.data)).slice(0, 8);
    const presentes = pres.filter((p) => p.presente).length;
    const faltas = pres.filter((p) => !p.presente).length;
    const total = pres.length;
    const taxa = total ? Math.round((presentes / total) * 100) : null;
    let faltasConsec = 0;
    for (const p of pres) { if (!p.presente) faltasConsec++; else break; }
    const ultimaPresenca = pres.find((p) => p.presente)?.sessao.data || null;

    // pagamento
    let pg: "em_dia" | "vence" | "atrasado" = "em_dia";
    for (const r of c.recebiveis) {
      const v = r.vencimento ? new Date(r.vencimento) : null;
      if (r.status === "vencida" || (v && v < now)) { pg = "atrasado"; break; }
      if (v && v <= em7dias) pg = "vence";
    }
    const assinaturaAtiva = c.assinaturas.some((a: any) => a.status === "ativa");

    // score + flags
    const flags: string[] = [];
    if (faltasConsec >= 2) flags.push(`${faltasConsec} faltas seguidas`);
    else if (faltasConsec === 1) flags.push("faltou na última sessão");
    if (pg === "atrasado") flags.push("pagamento atrasado");
    else if (pg === "vence") flags.push("pagamento vence em 7 dias");
    if (assinaturaAtiva && total === 0) flags.push("nunca registrado em sessão");
    if (taxa !== null && taxa < 60 && total >= 3) flags.push(`presença baixa (${taxa}%)`);
    if (!c.consentimentoLGPD) flags.push("sem consentimento LGPD");

    let score: "verde" | "amarelo" | "vermelho" = "verde";
    if (faltasConsec >= 2 || pg === "atrasado") score = "vermelho";
    else if (pg === "vence" || faltasConsec === 1 || (assinaturaAtiva && total === 0) || (taxa !== null && taxa < 60 && total >= 3)) score = "amarelo";

    return {
      id: c.id, nome: c.nome, score, flags,
      presenca: { presentes, faltas, total, taxa, faltasConsec, ultimaPresenca: ultimaPresenca ? new Date(ultimaPresenca).toISOString().slice(0, 10) : null },
      pagamento: pg,
      assinaturaAtiva,
    };
  });

  const ordem = { vermelho: 0, amarelo: 1, verde: 2 } as const;
  pacientes.sort((a, b) => ordem[a.score] - ordem[b.score] || b.presenca.faltasConsec - a.presenca.faltasConsec);

  const resumo = {
    total: pacientes.length,
    vermelho: pacientes.filter((p) => p.score === "vermelho").length,
    amarelo: pacientes.filter((p) => p.score === "amarelo").length,
    verde: pacientes.filter((p) => p.score === "verde").length,
  };

  return NextResponse.json({ pacientes, resumo });
}
