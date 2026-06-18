import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password, remember } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }
  if (user.status === "pending") {
    return NextResponse.json({ error: "Sua conta está aguardando aprovação do administrador." }, { status: 403 });
  }
  if (user.status === "disabled") {
    return NextResponse.json({ error: "Sua conta está desativada." }, { status: 403 });
  }
  if (user.emailVerified === false) {
    return NextResponse.json({ error: "Confirme seu e-mail antes de entrar (enviamos um link no cadastro)." }, { status: 403 });
  }
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };
  setAuthCookie(signToken(session), remember !== false);
  return NextResponse.json({ user: session });
}
