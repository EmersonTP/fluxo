import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notify";
import { sendEmail, emailEnabled, emailLayout } from "@/lib/email";

// "Esqueci minha senha": envia link de redefinição por e-mail (Resend).
// Se não houver provedor de e-mail, avisa os admins pra redefinir no painel.
// Sempre responde ok (não revela se o e-mail existe).
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const normalized = (email || "").toLowerCase().trim();
  // sent reflete só a CONFIGURAÇÃO do provedor (não revela se o e-mail existe)
  const sent = emailEnabled();
  if (!normalized) return NextResponse.json({ ok: true, sent });

  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, name: true, email: true } });
  if (!user) return NextResponse.json({ ok: true, sent });

  if (emailEnabled()) {
    const token = randomBytes(24).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp: new Date(Date.now() + 60 * 60 * 1000) }, // 1h
    });
    const link = `${new URL(req.url).origin}/redefinir?token=${token}`;
    await sendEmail(
      user.email,
      "Redefinir sua senha · Sandra",
      emailLayout("Redefinir senha", `Recebemos um pedido pra redefinir a senha da sua conta na Sandra. O link vale por 1 hora.`, { label: "Criar nova senha", url: link })
    );
  } else {
    // Fallback sem e-mail: avisa os admins
    const admins = await prisma.user.findMany({ where: { role: { in: ["owner", "admin"] }, status: "active" }, select: { id: true } });
    await createNotifications(
      admins.map((a: { id: string }) => a.id),
      "reset",
      `${user.name} (${user.email}) pediu para redefinir a senha.`,
      "/admin",
      user.id
    );
  }
  return NextResponse.json({ ok: true, sent });
}
