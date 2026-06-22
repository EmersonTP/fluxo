import { NextResponse } from "next/server";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";
import { getInterConfig, getExtrato } from "@/lib/inter";

export const runtime = "nodejs";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// Extrato bancário do Inter (escopo Banking). Normaliza os lançamentos.
// GET /api/finance/inter/extrato?company=X&de=YYYY-MM-DD&ate=YYYY-MM-DD
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  // Período: padrão últimos 30 dias.
  const hoje = new Date();
  const trintaAtras = new Date(hoje.getTime() - 30 * 864e5);
  const de = url.searchParams.get("de") || ymd(trintaAtras);
  const ate = url.searchParams.get("ate") || ymd(hoje);

  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado nesta empresa." }, { status: 400 });

  let raw: any;
  try {
    raw = await getExtrato(cfg, de, ate);
  } catch (e: any) {
    return NextResponse.json({ error: `Inter recusou o extrato: ${e.message}` }, { status: 400 });
  }

  // Inter retorna { transacoes: [ { dataEntrada, tipoOperacao(C/D), valor, titulo, descricao } ] }
  const lista: any[] = Array.isArray(raw?.transacoes) ? raw.transacoes : Array.isArray(raw) ? raw : [];
  const lancamentos = lista.map((t: any) => {
    const tipo = (t.tipoOperacao || t.tipo || "").toUpperCase() === "C" ? "credito" : "debito";
    return {
      data: t.dataEntrada || t.dataInclusao || t.data || null,
      tipo, // credito (entrada) | debito (saída)
      valor: Number(t.valor || 0),
      titulo: t.titulo || t.tipoTransacao || "",
      descricao: t.descricao || t.detalhes?.descricaoOperacao || "",
    };
  });

  const totalCredito = lancamentos.filter((l) => l.tipo === "credito").reduce((s, l) => s + l.valor, 0);
  const totalDebito = lancamentos.filter((l) => l.tipo === "debito").reduce((s, l) => s + l.valor, 0);

  return NextResponse.json({
    periodo: { de, ate },
    totalCredito, totalDebito, saldoMovimento: totalCredito - totalDebito,
    quantidade: lancamentos.length,
    lancamentos,
  });
}
