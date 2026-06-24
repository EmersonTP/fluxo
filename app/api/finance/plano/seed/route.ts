import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

// Plano de contas padrão da Emerson (fluxo de caixa em 3 blocos) + regras de auto-categorização.
// [bloco, grupo, nome, tipo]
const CATEGORIAS: [string, string, string, string][] = [
  // OPERACIONAL — receita
  ["operacional", "Receita", "Membership", "receita"],
  ["operacional", "Receita", "Outras receitas", "receita"],
  // OPERACIONAL — despesa
  ["operacional", "Marketing", "Tráfego Pago", "despesa"],
  ["operacional", "Marketing", "Equipe de Marketing", "despesa"],
  ["operacional", "Marketing", "Materiais", "despesa"],
  ["operacional", "Comercial", "Salário Comercial", "despesa"],
  ["operacional", "Comercial", "Comissão", "despesa"],
  ["operacional", "Pessoal", "Financeiro", "despesa"],
  ["operacional", "Pessoal", "Recrutamento/Headhunting", "despesa"],
  ["operacional", "Administrativo", "Contabilidade", "despesa"],
  ["operacional", "Administrativo", "Software e Ferramentas", "despesa"],
  ["operacional", "Administrativo", "Taxas, Cartório e Registros", "despesa"],
  ["operacional", "Administrativo", "Transporte", "despesa"],
  ["operacional", "Financeiras", "Cartão de crédito", "despesa"],
  // INVESTIMENTO
  ["investimento", "Ativo Intangível", "Desenvolvimento de Software", "despesa"],
  ["investimento", "Ativo Intangível", "Marca (INPI)", "despesa"],
  ["investimento", "Aplicações Financeiras", "CDB", "despesa"],
  // FINANCIAMENTO
  ["financiamento", "Aporte de Sócios", "Aporte", "receita"],
  // INTERNO (excluído dos 3 blocos no relatório)
  ["interno", "Transferência entre contas", "Interno", "despesa"],
  // ---- Categorias adicionais (plano completo, prontas pra seleção) ----
  ["operacional", "Custo dos Serviços", "Terapeutas / Prestadores", "despesa"],
  ["operacional", "Pessoal", "Pró-labore", "despesa"],
  ["operacional", "Administrativo", "Hospedagem / Infra", "despesa"],
  ["operacional", "Administrativo", "Telecom", "despesa"],
  ["operacional", "Financeiras", "IOF / Tarifas bancárias", "despesa"],
  ["operacional", "Financeiras", "Juros", "despesa"],
  ["financiamento", "Conta de Sócios", "Reembolso (pré-operacional)", "despesa"],
];

// Departamentos (centros de custo) — a ÁREA. Dimensão separada da categoria.
const DEPARTAMENTOS = [
  "Marketing", "Comercial", "Tecnologia / Produto",
  "Clínico / Operações", "Administrativo / Financeiro", "Não-operacional",
];

// [padrao, grupo, nome, aplicaA, prioridade]
const REGRAS: [string, string, string, string, number][] = [
  ["BELOTTI", "Ativo Intangível", "Desenvolvimento de Software", "ambos", 10],
  ["HTECH", "Ativo Intangível", "Desenvolvimento de Software", "ambos", 10],
  ["TILLER", "Ativo Intangível", "Desenvolvimento de Software", "ambos", 10],
  ["JB DIGIT", "Marketing", "Tráfego Pago", "debito", 10],
  ["ANDREZA", "Marketing", "Equipe de Marketing", "debito", 10],
  ["ZAYN", "Marketing", "Equipe de Marketing", "debito", 10],
  ["MKN", "Marketing", "Materiais", "debito", 10],
  ["CHRISTIANE", "Comercial", "Salário Comercial", "debito", 10],
  ["NAYARA", "Pessoal", "Financeiro", "debito", 10],
  ["JOAO VITOR", "Pessoal", "Recrutamento/Headhunting", "debito", 10],
  ["JOÃO VITOR", "Pessoal", "Recrutamento/Headhunting", "debito", 10],
  ["BEDIN", "Administrativo", "Contabilidade", "debito", 10],
  ["AVANTGARDE", "Administrativo", "Contabilidade", "debito", 10],
  ["OMIE", "Administrativo", "Software e Ferramentas", "debito", 10],
  ["INPI", "Ativo Intangível", "Marca (INPI)", "debito", 20],
  ["TABELIAO", "Administrativo", "Taxas, Cartório e Registros", "debito", 10],
  ["TABELIÃO", "Administrativo", "Taxas, Cartório e Registros", "debito", 10],
  ["DIRETORIA GERAL DE FINANC", "Administrativo", "Taxas, Cartório e Registros", "debito", 10],
  ["INPC", "Administrativo", "Taxas, Cartório e Registros", "debito", 5],
  ["UBER", "Administrativo", "Transporte", "debito", 10],
  ["FATURA INTER", "Financeiras", "Cartão de crédito", "debito", 20],
  ["APLICACAO", "Aplicações Financeiras", "CDB", "ambos", 20],
  ["RESGATE", "Aplicações Financeiras", "CDB", "ambos", 20],
  ["CDB", "Aplicações Financeiras", "CDB", "ambos", 5],
  ["GIANCARLO", "Aporte de Sócios", "Aporte", "credito", 20],
  ["GIANLUCCA", "Aporte de Sócios", "Aporte", "credito", 20],
  ["EMERSON HEALTHTECH", "Transferência entre contas", "Interno", "ambos", 15],
  // Pacientes → Receita Membership (recebimentos Pix)
  ...(["ELIANA", "GIULIA", "MALIZIA", "SERON", "JOAQUIM", "JAQUELINE", "ROSI", "BETINHO", "BARBARA", "BÁRBARA", "BORGES", "ALEXSANDRO", "ZYAN", "MARCIA", "ANDRÉIA", "FERNANDO", "BRETT", "GABRIELLA", "AMADEU"]
    .map((n) => [n, "Receita", "Membership", "credito", 8] as [string, string, string, string, number])),
];

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  // 1) upsert categorias e guarda o id por "grupo|nome"
  const idByKey = new Map<string, string>();
  let ordem = 0;
  for (const [bloco, grupo, nome, tipo] of CATEGORIAS) {
    const c = await prisma.categoria.upsert({
      where: { companyId_grupo_nome: { companyId, grupo, nome } },
      create: { companyId, grupo, nome, tipo, bloco, ordem: ordem++ },
      update: { tipo, bloco },
    });
    idByKey.set(`${grupo}|${nome}`, c.id);
  }

  // 2) recria as regras (idempotente)
  await prisma.categoriaRegra.deleteMany({ where: { companyId } });
  let regrasCriadas = 0;
  for (const [padrao, grupo, nome, aplicaA, prioridade] of REGRAS) {
    const categoriaId = idByKey.get(`${grupo}|${nome}`);
    if (!categoriaId) continue;
    await prisma.categoriaRegra.create({ data: { companyId, padrao: padrao.toUpperCase(), aplicaA, prioridade, categoriaId } });
    regrasCriadas++;
  }

  // 3) departamentos (centros de custo)
  let depOrdem = 0;
  for (const nome of DEPARTAMENTOS) {
    await prisma.departamento.upsert({
      where: { companyId_nome: { companyId, nome } },
      create: { companyId, nome, ordem: depOrdem++ },
      update: {},
    });
  }

  return NextResponse.json({ ok: true, categorias: CATEGORIAS.length, departamentos: DEPARTAMENTOS.length, regras: regrasCriadas });
}
