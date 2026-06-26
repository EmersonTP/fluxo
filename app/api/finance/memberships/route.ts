import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { encryptField } from "@/lib/crypto";
import { getInterConfig, createCobranca, getCobranca } from "@/lib/inter";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Cadastro único de membership: cria paciente + (assinatura, se recorrente) + 1ª conta a receber
// e emite a cobrança (boleto+Pix) no Inter. Se a emissão falhar, registra o título mesmo assim.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  const companyId = b.companyId || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Só admin ou financeiro." }, { status: 403 });

  const p = b.paciente || {};
  if (!p.nome?.trim()) return NextResponse.json({ error: "Nome do paciente é obrigatório." }, { status: 400 });
  if (!b.vencimento) return NextResponse.json({ error: "Informe o 1º vencimento." }, { status: 400 });

  // valor: plano ou avulso
  let valorCents = b.valor ? Math.round(Number(b.valor) * 100) : 0;
  let planoId: string | null = b.planoId || null;
  if (planoId) {
    const plano = await prisma.plano.findUnique({ where: { id: planoId }, select: { valorCents: true, companyId: true } });
    if (!plano || plano.companyId !== companyId) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    if (!valorCents) valorCents = plano.valorCents || 0;
  }
  if (!valorCents || valorCents <= 0) return NextResponse.json({ error: "Informe um valor (ou um plano com valor)." }, { status: 400 });

  const recorrencia = b.recorrencia === "unica" ? "unica" : "mensal";
  const situacao = ["emitir", "pago", "registrar"].includes(b.situacao) ? b.situacao : "emitir";
  const venc = new Date(String(b.vencimento).slice(0, 10) + "T12:00:00");
  const dia = b.diaCobranca ? Number(b.diaCobranca) : venc.getDate();

  // 1) paciente (cliente) — CPF cifrado
  const cliente = await prisma.cliente.create({
    data: {
      companyId, nome: p.nome.trim(), email: (p.email || "").trim(), telefone: p.telefone || null,
      rg: p.rg || null, cep: p.cep || null, logradouro: p.logradouro || null, numero: p.numero || null,
      complemento: p.complemento || null, bairro: p.bairro || null, cidade: p.cidade || null, uf: p.uf || null,
      documentoEnc: p.documento ? encryptField(String(p.documento)) : null,
      consentimentoLGPD: !!p.consentimentoLGPD,
      consentimentoEm: p.consentimentoLGPD ? new Date() : null,
      consentimentoBase: p.consentimentoLGPD ? "execução de contrato" : null,
    },
  });

  // 2) assinatura (se recorrente). Sem plano selecionado, usa um plano "Avulso" (valor por paciente) por empresa.
  let assinatura: any = null;
  if (recorrencia === "mensal") {
    if (!planoId) {
      const avulso = await prisma.plano.upsert({
        where: { companyId_identifier: { companyId, identifier: "avulso" } },
        update: {},
        create: { companyId, nome: "Avulso (valor por paciente)", identifier: "avulso", valorCents: 0 },
      });
      planoId = avulso.id;
    }
    const prox = new Date(venc.getFullYear(), venc.getMonth() + 1, Math.min(dia, 28));
    assinatura = await prisma.assinatura.create({
      data: { companyId, clienteId: cliente.id, planoId, status: "ativa", valorCents, diaCobranca: dia, proximaCobranca: prox },
    });
  }

  // 3) emite cobrança no Inter (boleto+Pix); fallback: título sem cobrança
  const valorReais = valorCents / 100;
  const doc = String(p.documento || "").replace(/\D/g, "");
  let cobranca: any = null;
  let warning: string | null = null;
  const cfg = await getInterConfig(companyId);
  const podeEmitir = !!cfg && (doc.length === 11 || doc.length === 14) && p.cep && p.logradouro && p.cidade && p.uf;

  if (situacao === "emitir" && podeEmitir) {
    try {
      const seuNumero = ("M" + Date.now().toString(36)).slice(0, 15);
      const payload: Record<string, unknown> = {
        seuNumero, valorNominal: Number(valorReais.toFixed(2)), dataVencimento: venc.toISOString().slice(0, 10), numDiasAgenda: 30,
        pagador: {
          cpfCnpj: doc, tipoPessoa: doc.length === 14 ? "JURIDICA" : "FISICA", nome: String(p.nome).slice(0, 100),
          endereco: String(p.logradouro).slice(0, 90), numero: p.numero ? String(p.numero).slice(0, 10) : "S/N",
          bairro: p.bairro ? String(p.bairro).slice(0, 60) : undefined, cidade: String(p.cidade).slice(0, 60),
          uf: String(p.uf).slice(0, 2).toUpperCase(), cep: String(p.cep).replace(/\D/g, ""),
        },
      };
      const created = await createCobranca(cfg!, payload);
      const cod = created?.codigoSolicitacao;
      if (!cod) throw new Error("Inter não retornou código.");
      let det: any = null; try { det = await getCobranca(cfg!, cod); } catch {}
      cobranca = { codigoSolicitacao: cod, pixCopiaECola: det?.pix?.pixCopiaECola || null, secureUrl: det?.boleto?.linkPdf || null, linhaDigitavel: det?.boleto?.linhaDigitavel || null };
    } catch (e: any) { warning = `Paciente e título criados, mas a cobrança no Inter falhou: ${e.message}. Emita depois em Cobrança.`; }
  } else if (situacao === "emitir" && !podeEmitir) {
    warning = !cfg ? "Inter não conectado: título criado sem cobrança." : "Faltam dados do pagador (CPF + endereço) para o boleto: título criado, emita o Pix/boleto depois.";
  }

  // 4) recebível
  const pago = situacao === "pago";
  const pagoEm = pago ? (b.pagoEm ? new Date(String(b.pagoEm).slice(0, 10) + "T12:00:00") : venc) : null;
  const receivable = await prisma.receivable.create({
    data: {
      companyId, provider: cobranca ? "inter" : "manual",
      externalId: cobranca?.codigoSolicitacao || null,
      descricao: b.descricao || `Membership — ${p.nome}`,
      valorCents, status: pago ? "paga" : "pendente", pagoEm, metodo: cobranca ? "boleto_pix" : null,
      vencimento: venc, pixCopiaECola: cobranca?.pixCopiaECola || null, secureUrl: cobranca?.secureUrl || null,
      origem: assinatura ? "assinatura" : "avulsa", clienteId: cliente.id, assinaturaId: assinatura?.id || null,
    },
  });

  await logAudit({ req, user, action: "create", entity: "recebivel", entityId: receivable.id, companyId, meta: `membership ${p.nome} ${recorrencia} R$ ${valorReais.toFixed(2)}${cobranca ? " + cobrança Inter" : ""}` });

  return NextResponse.json({ ok: true, clienteId: cliente.id, assinaturaId: assinatura?.id || null, receivable, cobranca, warning });
}
