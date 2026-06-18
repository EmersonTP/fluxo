import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notify";

// "Esqueci minha senha" sem e-mail: avisa os admins, que redefinem no painel.
// Sempre responde ok (não revela se o e-mail existe).
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const normalized = (email || "").toLowerCase().trim();
  if (!normalized) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, name: true, email: true } });
  if (user) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["owner", "admin"] }, status: "active" },
      select: { id: true },
    });
    await createNotifications(
      admins.map((a: { id: string }) => a.id),
      "reset",
      `${user.name} (${user.email}) pediu para redefinir a senha.`,
      "/admin",
      user.id
    );
  }
  return NextResponse.json({ ok: true });
}
