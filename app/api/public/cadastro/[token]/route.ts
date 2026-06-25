import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptField } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

async function linkBy(token: string) {
  return prisma.onboardingLink.findUnique({ where: { token }, include: { plano: true, company: { select: { name: true } } } });
}

// Próxima data com o dia informado (a partir de hoje).
function nextDue(dia?: number | null): Date {
  const now = new Date();
  const d = dia && dia >= 1 && dia <= 28 ? dia : now.getDate();
  let due = new Date(now.getFullYear(), now.getMonth(), d);
  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due = new Date(now.getFullYear(), now.getMonth() + 1, d);
  return due;
}

// Info pública do link (sem dados sensíveis).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  if (!rateLimit(`cad-get:${clientIp(_req)}`, 40, 10 * 60 * 1000)) return NextResponse.json({ error: "Muitas requisições. Aguarde alguns minutos." }, { status: 429 });
  const l: any = await linkBy(params.token);
  if (!l || !l.ativo) return NextResponse.json({ error: "Link inválido ou desativado." }, { status: 404 });
  return NextResponse.json({
    empresa: l.company?.name, plano: l.plano?.nome,
    valor: ((l.valorCents ?? l.plano?.valorCents) || 0) / 100,
    diaCobranca: l.diaCobranca,
  });
}

// Cadastro self-service: cria cliente + assinatura + 1ª conta a receber.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ip = clientIp(req);
  if (!rateLimit(`cad-post-ip:${ip}`, 5, 10 * 60 * 1000) || !rateLimit(`cad-post-tok:${params.token}`, 15, 60 * 60 * 1000))
    return NextResponse.json({ error: "Muitas tentativas de cadastro. Tente novamente em alguns minutos." }, { status: 429 });
  const l: any = await linkBy(params.token);
  if (!l || !l.ativo) return NextResponse.json({ error: "Link inválido ou desativado." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (!b.nome?.trim() || !b.documento?.trim()) return NextResponse.json({ error: "Nome e CPF são obrigatórios." }, { status: 400 });
  if (!b.aceiteContrato || !b.aceiteLGPD) return NextResponse.json({ error: "É necessário aceitar o contrato e o tratamento de dados." }, { status: 400 });

  const companyId = l.companyId;
  const valorCents = l.valorCents ?? l.plano?.valorCents ?? 0;
  const dia = l.diaCobranca ?? null;
  const due = nextDue(dia);

  const cliente = await prisma.cliente.create({
    data: {
      companyId, nome: b.nome.trim(), email: (b.email || "").trim(), telefone: b.telefone || null,
      rg: b.rg || null, cep: b.cep || null, logradouro: b.logradouro || null, numero: b.numero || null,
      complemento: b.complemento || null, bairro: b.bairro || null, cidade: b.cidade || null, uf: b.uf || null,
      documentoEnc: encryptField(String(b.documento)),
      documento: encryptField(String(b.documento)) ? null : String(b.documento), // fallback se não houver chave
      consentimentoLGPD: true, consentimentoEm: new Date(), consentimentoBase: "execução de contrato e tutela da saúde",
    },
  });
  const assinatura = await prisma.assinatura.create({
    data: { companyId, clienteId: cliente.id, planoId: l.planoId, status: "ativa", valorCents, diaCobranca: dia, proximaCobranca: new Date(due.getFullYear(), due.getMonth() + 1, due.getDate()) },
  });
  await prisma.receivable.create({
    data: { companyId, descricao: `${l.plano?.nome || "Membership"} — ${cliente.nome}`, valorCents, status: "pendente", provider: "manual", origem: "assinatura", vencimento: due, clienteId: cliente.id, assinaturaId: assinatura.id },
  });
  await prisma.onboardingLink.update({ where: { id: l.id }, data: { usos: { increment: 1 } } });
  await logAudit({ req, action: "create", entity: "cliente", entityId: cliente.id, companyId, meta: "cadastro self-service" });
  return NextResponse.json({ ok: true, clienteId: cliente.id });
}
