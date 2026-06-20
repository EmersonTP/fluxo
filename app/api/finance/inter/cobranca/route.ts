import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getInterConfig, createPixCob, genTxid } from "@/lib/inter";

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
    select: { id: true, descricao: true, valorCents: true, status: true, metodo: true, vencimento: true, pagoEm: true, pixCopiaECola: true, externalId: true, createdAt: true },
  });
  return NextResponse.json({ recebiveis });
}

// Emite uma cobrança Pix imediata no Inter e registra o recebível (pendente).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  const { companyId, valorReais, descricao, clienteId, devedorNome, devedorDoc, expiracaoSegundos } = b;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  // Emitir cobrança é ação financeira: admin ou financeiro da empresa.
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) {
    return NextResponse.json({ error: "Só admin ou financeiro pode emitir cobrança." }, { status: 403 });
  }

  const valor = Number(valorReais);
  if (!valor || valor <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });

  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado nesta empresa." }, { status: 400 });

  const txid = genTxid();
  const devedor: Record<string, unknown> = {};
  if (devedorNome && devedorDoc) {
    const doc = String(devedorDoc).replace(/\D/g, "");
    devedor.nome = devedorNome;
    if (doc.length === 11) devedor.cpf = doc;
    else if (doc.length === 14) devedor.cnpj = doc;
  }

  const payload: Record<string, unknown> = {
    calendario: { expiracao: Number(expiracaoSegundos) || 86400 },
    valor: { original: valor.toFixed(2) },
    chave: cfg.pixKey,
    solicitacaoPagador: (descricao || "Cobrança").slice(0, 140),
    ...(devedor.nome ? { devedor } : {}),
  };

  let cob: any;
  try {
    cob = await createPixCob(cfg, txid, payload);
  } catch (e: any) {
    return NextResponse.json({ error: `Inter recusou a cobrança: ${e.message}` }, { status: 400 });
  }

  const pixCopiaECola = cob?.pixCopiaECola || cob?.pix_copia_e_cola || null;
  const secureUrl = cob?.location || cob?.loc?.location || null;

  const receivable = await prisma.receivable.create({
    data: {
      companyId,
      provider: "inter",
      externalId: txid,
      descricao: descricao || "Cobrança Pix",
      valorCents: Math.round(valor * 100),
      status: "pendente",
      metodo: "pix",
      pixCopiaECola,
      secureUrl,
      origem: "avulsa",
      clienteId: clienteId || null,
    },
  });

  return NextResponse.json({ receivable, txid, pixCopiaECola, secureUrl });
}
