import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { hasEncKey } from "@/lib/crypto";

export const runtime = "nodejs";

type Sev = "ok" | "atencao" | "critico";
type Check = { id: string; label: string; sev: Sev; detalhe: string; acao?: string };

// Estado de alerta do financeiro: roda checagens automáticas e devolve o que falta/está pendente.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const now = new Date();
  const checks: Check[] = [];

  // 1) Chave de criptografia (CPF)
  checks.push(hasEncKey()
    ? { id: "enc", label: "Criptografia de CPF", sev: "ok", detalhe: "DATA_ENC_KEY configurada." }
    : { id: "enc", label: "Criptografia de CPF", sev: "critico", detalhe: "DATA_ENC_KEY ausente — o CPF dos pacientes não está sendo gravado.", acao: "Configurar DATA_ENC_KEY no Railway." });

  // 2) Plano de contas seedado
  const nCat = await prisma.categoria.count({ where: { companyId } });
  checks.push(nCat > 0
    ? { id: "plano", label: "Plano de contas", sev: "ok", detalhe: `${nCat} categorias ativas.` }
    : { id: "plano", label: "Plano de contas", sev: "critico", detalhe: "Sem categorias.", acao: "Rodar o seed do plano de contas." });

  // 3) Integração Inter
  const inter = await prisma.integrationConfig.findFirst({ where: { companyId, provider: "inter" } });
  checks.push(inter
    ? { id: "inter", label: "Banco Inter conectado", sev: "ok", detalhe: "Credenciais salvas (extrato + cobrança)." }
    : { id: "inter", label: "Banco Inter conectado", sev: "atencao", detalhe: "Inter não conectado nesta empresa.", acao: "Conectar o Inter em Contas a Receber → Inter." });

  // 4) Aprovadores configurados
  const cfg = await prisma.approverConfig.findMany({ where: { companyId }, select: { role: true } });
  const temFin = cfg.some((c: any) => c.role === "financeiro");
  const temPag = cfg.some((c: any) => c.role === "pagador");
  checks.push(temFin && temPag
    ? { id: "aprov", label: "Esteira de aprovação", sev: "ok", detalhe: "Financeiro e pagador definidos." }
    : { id: "aprov", label: "Esteira de aprovação", sev: "atencao", detalhe: `Falta definir: ${[!temFin && "financeiro", !temPag && "pagador"].filter(Boolean).join(", ")}.`, acao: "Definir aprovadores em Configurações." });

  // 5) PIN de pagamento do usuário
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { paymentPinHash: true } });
  checks.push(me?.paymentPinHash
    ? { id: "pin", label: "PIN de pagamento", sev: "ok", detalhe: "PIN cadastrado." }
    : { id: "pin", label: "PIN de pagamento", sev: "atencao", detalhe: "Você ainda não cadastrou um PIN de pagamento.", acao: "Cadastrar em Segurança & LGPD." });

  // 6) Contas manuais sem extrato importado
  const contas = await prisma.bankAccount.findMany({ where: { companyId, conexao: "manual" }, include: { _count: { select: { transacoes: true } } } });
  const vazias = contas.filter((c: any) => c._count.transacoes === 0);
  if (vazias.length) checks.push({ id: "contas", label: "Extrato de contas manuais", sev: "atencao", detalhe: `${vazias.length} conta(s) sem extrato: ${vazias.map((c: any) => c.nome).join(", ")}.`, acao: "Importar o extrato (CSV)." });
  else checks.push({ id: "contas", label: "Extrato de contas manuais", sev: "ok", detalhe: "Todas as contas manuais têm lançamentos." });

  // 7) Títulos a receber vencidos
  const recVenc = await prisma.receivable.findMany({ where: { companyId, status: "pendente", vencimento: { lt: now } }, select: { valorCents: true } });
  const recTot = recVenc.reduce((s: number, r: any) => s + r.valorCents, 0) / 100;
  checks.push(recVenc.length
    ? { id: "rec", label: "Recebíveis vencidos", sev: "atencao", detalhe: `${recVenc.length} título(s) vencido(s) — R$ ${recTot.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`, acao: "Cobrar / conciliar em Contas a Receber." }
    : { id: "rec", label: "Recebíveis vencidos", sev: "ok", detalhe: "Nenhum recebível vencido." });

  // 8) Contas a pagar vencidas e ainda não pagas
  const pagVenc = await prisma.paymentRequest.findMany({ where: { companyId, status: { in: ["solicitada", "aprovada_gestor", "conferida"] }, vencimento: { lt: now } }, select: { valor: true } });
  const pagTot = pagVenc.reduce((s: number, r: any) => s + r.valor, 0);
  checks.push(pagVenc.length
    ? { id: "pag", label: "Contas a pagar vencidas", sev: "critico", detalhe: `${pagVenc.length} conta(s) vencida(s) sem pagamento — R$ ${pagTot.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`, acao: "Resolver em Contas a Pagar." }
    : { id: "pag", label: "Contas a pagar vencidas", sev: "ok", detalhe: "Nenhuma conta a pagar vencida." });

  // 9) Execução real de pagamento (trava)
  checks.push(process.env.PAYMENTS_LIVE === "1"
    ? { id: "live", label: "Execução de pagamento", sev: "atencao", detalhe: "PAYMENTS_LIVE ligado — pagamentos reais habilitados." }
    : { id: "live", label: "Execução de pagamento", sev: "ok", detalhe: "Trava ativa (PAYMENTS_LIVE desligado). Seguro." });

  const resumo = {
    critico: checks.filter((c: any) => c.sev === "critico").length,
    atencao: checks.filter((c: any) => c.sev === "atencao").length,
    ok: checks.filter((c: any) => c.sev === "ok").length,
  };
  return NextResponse.json({ checks, resumo });
}
