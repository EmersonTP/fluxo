import { NextResponse } from "next/server";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { getInterConfig, getInterToken } from "@/lib/inter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico dos escopos do Inter: pede um token para cada escopo (NÃO move dinheiro)
// e reporta quais a aplicação do Inter aceita e quais estão bloqueados.
const ESCOPOS: { scope: string; label: string; para: string }[] = [
  { scope: "extrato.read", label: "Leitura de extrato/saldo", para: "Ver saldo e conciliar recebimentos" },
  { scope: "cob.write cob.read", label: "Cobrança Pix (recebimento)", para: "Gerar cobrança Pix" },
  { scope: "boleto-cobranca.write boleto-cobranca.read", label: "Boleto + Pix (cobrança V3)", para: "Emitir boleto/bolepix" },
  { scope: "pagamento-pix.write", label: "Pagamento Pix (SAÍDA)", para: "Pagar por Pix pela Sandra" },
  { scope: "pagamento-boleto.write", label: "Pagamento de boleto (SAÍDA)", para: "Pagar boleto de fornecedor pela Sandra" },
];

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin roda o diagnóstico." }, { status: 403 });

  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado nesta empresa." }, { status: 400 });

  const resultados = [];
  for (const e of ESCOPOS) {
    try {
      await getInterToken(cfg, e.scope);
      resultados.push({ scope: e.scope, label: e.label, para: e.para, ok: true, erro: null });
    } catch (err: any) {
      resultados.push({ scope: e.scope, label: e.label, para: e.para, ok: false, erro: String(err?.message || err).slice(0, 240) });
    }
  }
  const pagamentoOk = resultados.find((r) => r.scope === "pagamento-pix.write")?.ok;
  return NextResponse.json({ resultados, podePagarPix: !!pagamentoOk });
}
