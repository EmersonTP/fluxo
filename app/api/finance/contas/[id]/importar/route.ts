import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, periodoFechado } from "@/lib/finance";

export const runtime = "nodejs";

function parseValor(s: string): number {
  let t = (s || "").replace(/[R$\s]/g, "").trim();
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  return Number(t) || 0;
}
function parseData(s: string): Date | null {
  s = (s || "").trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out.map((x) => x.trim().replace(/^"|"$/g, ""));
}

// Importa um extrato CSV numa conta manual. Idempotente por fitId (ou hash do lançamento).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const conta = await prisma.bankAccount.findUnique({ where: { id: params.id }, select: { id: true, companyId: true } });
  if (!conta || !canAccessCompany(user, conta.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") return NextResponse.json({ error: "Envie o conteúdo do CSV." }, { status: 400 });

  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: "CSV vazio." }, { status: 400 });
  const sep = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase());
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iData = idx("data");
  const iValor = idx("valor", "amount");
  const iDesc = idx("descri", "histFirst".toLowerCase(), "hist", "lançamento", "lancamento", "memo", "title");
  const iId = idx("identificador", "fitid", "id");
  if (iData < 0 || iValor < 0) return NextResponse.json({ error: "Não achei colunas Data/Valor no CSV." }, { status: 400 });

  const _co = await prisma.company.findUnique({ where: { id: conta.companyId }, select: { fechadoAte: true } });
  const _fechado = _co?.fechadoAte || null;
  const lote = "imp_" + Date.now().toString(36);
  let criados = 0, pulados = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i], sep);
    const data = parseData(c[iData]); const valor = parseValor(c[iValor]);
    if (!data || !valor) { pulados++; continue; }
    if (_fechado && data <= _fechado) { pulados++; continue; }
    const descricao = (iDesc >= 0 ? c[iDesc] : "").slice(0, 200);
    const rawId = iId >= 0 && c[iId] ? c[iId] : crypto.createHash("md5").update(`${c[iData]}|${valor}|${descricao}`).digest("hex");
    try {
      await prisma.bankTransaction.create({
        data: {
          accountId: conta.id, companyId: conta.companyId, data, valor,
          tipo: valor >= 0 ? "credito" : "debito", descricao,
          origem: "import", fitId: rawId, importLote: lote,
        },
      });
      criados++;
    } catch { pulados++; /* duplicado (mesmo fitId) */ }
  }
  return NextResponse.json({ ok: true, criados, pulados });
}
