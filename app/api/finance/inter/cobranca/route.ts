import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getInterConfig, createCobranca, getCobranca } from "@/lib/inter";

export const runtime = "nodejs";

// Lista os recebíveis do Inter da empresa (mais recentes primeiro).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ recebiveis: [] });
  const recebiveis = await prisma.receivable.findMany({
    where: { companyId, provider: "inter" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, descricao: true, valorCents: true, status: true, metodo: true, vencimento: true, pagoEm: true, pixCopiaECola: true, secureUrl: true, externalId: true, createdAt: true },
  });
  return NextResponse.json({ recebiveis });
}

// Emite uma cobrança (boleto + Pix / "bolepix") no Inter via API de Cobrança v3
// e registra o recebível (pendente). O escopo "Cobranças" cobre este endpoint.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  const {
    companyId, valorReais, descricao, clienteId, vencimento,
    devedorNome, devedorDoc, cep, endereco, numero, bairro, cidade, uf,
  } = b;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  // Emitir cobrança é ação financeira: admin ou financeiro da empresa.
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) {
    return NextResponse.json({ error: "Só admin ou financeiro pode emitir cobrança." }, { status: 403 });
  }

  const valor = Number(valorReais);
  if (!valor || valor <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  if (!vencimento) return NextResponse.json({ error: "Informe o vencimento." }, { status: 400 });

  // Boleto exige dados completos do pagador.
  const doc = String(devedorDoc || "").replace(/\D/g, "");
  if (!devedorNome) return NextResponse.json({ error: "Informe o nome do pagador." }, { status: 400 });
  if (doc.length !== 11 && doc.length !== 14) return NextResponse.json({ error: "CPF/CNPJ do pagador inválido." }, { status: 400 });
  if (!cep || !endereco || !cidade || !uf) {
    return NextResponse.json({ error: "Boleto exige endereço do pagador: CEP, endereço, cidade e UF." }, { status: 400 });
  }

  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado nesta empresa." }, { status: 400 });

  const seuNumero = ("S" + Date.now().toString(36)).slice(0, 15);
  const payload: Record<string, unknown> = {
    seuNumero,
    valorNominal: Number(valor.toFixed(2)),
    dataVencimento: String(vencimento).slice(0, 10),
    numDiasAgenda: 30, // dias após o vencimento para baixa automática
    pagador: {
      cpfCnpj: doc,
      tipoPessoa: doc.length === 14 ? "JURIDICA" : "FISICA",
      nome: String(devedorNome).slice(0, 100),
      endereco: String(endereco).slice(0, 90),
      numero: numero ? String(numero).slice(0, 10) : "S/N",
      bairro: bairro ? String(bairro).slice(0, 60) : undefined,
      cidade: String(cidade).slice(0, 60),
      uf: String(uf).slice(0, 2).toUpperCase(),
      cep: String(cep).replace(/\D/g, ""),
    },
  };

  let created: any;
  try {
    created = await createCobranca(cfg, payload);
  } catch (e: any) {
    return NextResponse.json({ error: `Inter recusou a cobrança: ${e.message}` }, { status: 400 });
  }
  const codigoSolicitacao = created?.codigoSolicitacao;
  if (!codigoSolicitacao) return NextResponse.json({ error: "Inter não retornou o código da cobrança." }, { status: 400 });

  // Busca o detalhe pra pegar boleto (linha digitável / link) e Pix copia-e-cola.
  let det: any = null;
  try { det = await getCobranca(cfg, codigoSolicitacao); } catch { /* segue sem detalhe; webhook atualiza depois */ }

  const boleto = det?.boleto || {};
  const pix = det?.pix || {};
  const pixCopiaECola = pix?.pixCopiaECola || null;
  const secureUrl = boleto?.linkPdf || det?.boleto?.linkPdf || null;
  const linhaDigitavel = boleto?.linhaDigitavel || null;

  const receivable = await prisma.receivable.create({
    data: {
      companyId,
      provider: "inter",
      externalId: codigoSolicitacao,
      descricao: descricao || "Cobrança (boleto/Pix)",
      valorCents: Math.round(valor * 100),
      status: "pendente",
      metodo: "boleto_pix",
      vencimento: new Date(String(vencimento).slice(0, 10)),
      pixCopiaECola,
      secureUrl,
      origem: "avulsa",
      clienteId: clienteId || null,
    },
  });

  return NextResponse.json({ receivable, codigoSolicitacao, pixCopiaECola, linhaDigitavel, secureUrl });
}
