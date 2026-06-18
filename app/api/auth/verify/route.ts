import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Confirma o e-mail a partir do token enviado no cadastro.
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { verifyToken: token } });
  if (!user) return NextResponse.json({ error: "Link inválido ou já usado." }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyToken: null },
  });
  return NextResponse.json({ ok: true });
}
