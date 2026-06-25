import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { getInterConfig, getExtrato } from "@/lib/inter";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function chunksMensais(de: string, ate: string): [string, string][] {
  const out: [string, string][] = []; let cur = new Date(de + "T00:00:00"); const fim = new Date(ate + "T00:00:00");
  while (cur <= fim) {
    const ini = new Date(cur.getFullYear(), cur.getMonth(), 1); const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push([ymd(ini > new Date(de + "T00:00:00") ? ini : new Date(de + "T00:00:00")), ymd(fimMes < fim ? fimMes : fim)]);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

// Puxa o extrato do Inter e grava em BankTransaction (idempotente por fitId). Roda sob demanda ou agendado.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json().catch(() => ({}));
  const companyId = b.companyId || new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado." }, { status: 400 });

  // conta "Inter PJ" (conexao inter)
  let conta = await prisma.bankAccount.findFirst({ where: { companyId, conexao: "inter" } });
  if (!conta) { const n = await prisma.bankAccount.count({ where: { companyId } }); conta = await prisma.bankAccount.create({ data: { companyId, nome: "Inter PJ", banco: "inter", conexao: "inter", ordem: n } }); }

  const ate = b.ate || ymd(new Date());
  const de = b.de || ymd(new Date(2025, 10, 1)); // nov/2025
  let criados = 0, pulados = 0; const erros: string[] = [];
  for (const [d1, d2] of chunksMensais(de, ate)) {
    try {
      const raw: any = await getExtrato(cfg, d1, d2);
      const lista: any[] = Array.isArray(raw?.transacoes) ? raw.transacoes : Array.isArray(raw) ? raw : [];
      for (const t of lista) {
        const dataStr = (t.dataEntrada || t.dataInclusao || t.data || "").slice(0, 10);
        if (!dataStr) { pulados++; continue; }
        const tipo = (t.tipoOperacao || t.tipo || "").toUpperCase() === "C" ? "credito" : "debito";
        const valor = Number(t.valor || 0);
        const descricao = (t.descricao || t.detalhes?.descricaoOperacao || t.titulo || "").slice(0, 200);
        const fitId = t.idTransacao || t.id || crypto.createHash("md5").update(`${dataStr}|${tipo}|${valor}|${descricao}`).digest("hex");
        try {
          await prisma.bankTransaction.create({ data: { accountId: conta.id, companyId, data: new Date(dataStr), tipo, valor: tipo === "debito" ? -Math.abs(valor) : Math.abs(valor), descricao, origem: "inter", fitId } });
          criados++;
        } catch { pulados++; }
      }
    } catch (e: any) { erros.push(`${d1}: ${e.message}`); }
  }
  await prisma.bankAccount.update({ where: { id: conta.id }, data: { lastSyncAt: new Date() } });
  await logAudit({ req, user, action: "update", entity: "extrato", companyId, meta: `sync inter: ${criados} novos` });
  return NextResponse.json({ ok: true, criados, pulados, erros, contaId: conta.id });
}
