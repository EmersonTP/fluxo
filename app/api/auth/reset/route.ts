import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/email";

// Define uma nova senha a partir do token de redefinição (link do e-mail).
export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  if (String(password).length < 6) return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetTokenExp || new Date(user.resetTokenExp) < new Date()) {
    return NextResponse.json({ error: "Link inválido ou expirado. Peça um novo em “Esqueci minha senha”." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(String(password)), resetToken: null, resetTokenExp: null, emailVerified: true },
  });

  // Confirmação de segurança
  sendEmail(
    user.email,
    "Sua senha foi alterada · Sandra",
    emailLayout("Senha alterada", `A senha da sua conta na Sandra acabou de ser alterada. Se não foi você, fale com o administrador imediatamente.`)
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
