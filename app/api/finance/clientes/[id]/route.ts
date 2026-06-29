import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";
import { decryptField, maskDoc } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Ficha completa do cliente/paciente — tudo que um painel de Contas a Receber deve ter:
// cadastro, qualificação (engajamento/presença), assinatura/plano, desde quando, recebíveis + histórico, MRR.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const c: any = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      assinaturas: { orderBy: { createdAt: "asc" }, include: { plano: true } },
      recebiveis: { orderBy: [{ vencimento: "desc" }, { createdAt: "desc" }] },
      presencasSessao: { include: { sessao: true } },
      documentos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const partes = [c.logradouro, c.numero && "nº " + c.numero, c.complemento, c.bairro, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : (c.cidade || c.uf), c.cep && "CEP " + c.cep].filter(Boolean);
  const ativa = c.assinaturas.find((a: any) => a.status === "ativa");
  const valorAssin = (a: any) => (a?.valorCents ?? a?.plano?.valorCents ?? 0) / 100;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const recebiveis = c.recebiveis.map((r: any) => {
    const vencido = r.status === "pendente" && r.vencimento && new Date(r.vencimento) < hoje;
    return {
      id: r.id, descricao: r.descricao, valor: r.valorCents / 100,
      status: vencido ? "vencida" : r.status, metodo: r.metodo,
      vencimento: r.vencimento, pagoEm: r.pagoEm, secureUrl: r.secureUrl, origem: r.origem,
    };
  });
  const soma = (f: (r: any) => boolean) => recebiveis.filter(f).reduce((s: number, r: any) => s + r.valor, 0);
  const cnt = (f: (r: any) => boolean) => recebiveis.filter(f).length;
  const emAberto = (r: any) => r.status === "pendente";
  const vencidaF = (r: any) => r.status === "vencida";
  const pagaF = (r: any) => r.status === "paga";
  const datasPagas = recebiveis.filter(pagaF).map((r: any) => r.pagoEm).filter(Boolean).map((d: any) => new Date(d));
  const ultimoPagamento = datasPagas.length ? new Date(Math.max(...datasPagas.map((d: Date) => d.getTime()))) : null;

  const marcadas = c.presencasSessao.filter((p: any) => p.marcado).length;
  const presentes = c.presencasSessao.filter((p: any) => p.presente).length;
  const taxaPresenca = marcadas > 0 ? Math.round((presentes / marcadas) * 100) : null;

  await logAudit({ req, user, action: "view", entity: "cliente", entityId: c.id, companyId: c.companyId, meta: "ficha do paciente" });

  return NextResponse.json({
    cliente: {
      id: c.id, nome: c.nome, email: c.email || null, telefone: c.telefone || null,
      documento: maskDoc(decryptField(c.documentoEnc) ?? c.documento), rg: c.rg || null,
      endereco: partes.join(" — ") || null, ativo: c.ativo,
      consentimentoLGPD: c.consentimentoLGPD, consentimentoEm: c.consentimentoEm, consentimentoBase: c.consentimentoBase,
      desdeCadastro: c.createdAt,
    },
    assinatura: ativa ? {
      id: ativa.id, plano: ativa.plano?.nome || "—", valor: valorAssin(ativa), status: ativa.status,
      proximaCobranca: ativa.proximaCobranca, diaCobranca: ativa.diaCobranca, desde: ativa.createdAt,
    } : null,
    assinaturasHist: c.assinaturas.map((a: any) => ({ id: a.id, plano: a.plano?.nome || "—", valor: valorAssin(a), status: a.status, desde: a.createdAt })),
    resumo: {
      mrr: ativa ? valorAssin(ativa) : 0,
      emAbertoValor: soma(emAberto) + soma(vencidaF), emAbertoCount: cnt(emAberto) + cnt(vencidaF),
      vencidoValor: soma(vencidaF), vencidoCount: cnt(vencidaF),
      pagoTotal: soma(pagaF), pagoCount: cnt(pagaF),
      ultimoPagamento,
      desdeCliente: c.createdAt,
    },
    qualificacao: { marcadas, presentes, taxaPresenca },
    recebiveis,
    documentos: c.documentos.map((d: any) => ({ id: d.id, tipo: d.tipo, filename: d.filename, createdAt: d.createdAt })),
  });
}
