import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { hashPin } from "@/lib/pin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Diz se o usuário já tem PIN de pagamento definido (nunca devolve o PIN).
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { paymentPinHash: true } });
  return NextResponse.json({ hasPin: !!u?.paymentPinHash });
}

// Define/troca o PIN de pagamento do próprio usuário.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { pin } = await req.json();
  if (!pin || String(pin).length < 4) return NextResponse.json({ error: "O PIN deve ter pelo menos 4 dígitos." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { paymentPinHash: hashPin(String(pin)) } });
  await logAudit({ req, user, action: "update", entity: "config", meta: "definiu/alterou PIN de pagamento" });
  return NextResponse.json({ ok: true });
}
