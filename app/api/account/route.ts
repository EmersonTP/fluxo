import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";

// Update own profile: name and/or password.
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { name, color, currentPassword, newPassword } = await req.json();
  const data: any = {};

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "Nome não pode ficar vazio." }, { status: 400 });
    data.name = name.trim();
  }
  if (color !== undefined && /^#[0-9a-fA-F]{6}$/.test(color)) {
    data.color = color;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "A nova senha deve ter ao menos 6 caracteres." }, { status: 400 });
    }
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.passwordHash) {
      if (!currentPassword || !(await verifyPassword(currentPassword, dbUser.passwordHash))) {
        return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
      }
    }
    data.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
