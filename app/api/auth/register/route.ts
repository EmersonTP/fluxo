import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";

// Registration rules:
// - First user ever => owner + active (logged in immediately).
// - Existing imported member (no password) => activates account, logs in.
// - Everyone else => created as "pending"; must be approved by an admin.
export async function POST(req: Request) {
  const { name, email, password, remember } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });

  if (existing && existing.passwordHash) {
    return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
  }

  const isFirst = (await prisma.user.count()) === 0;

  if (existing) {
    // Imported member activating their account
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), name, status: "active" },
    });
    const session = { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
    setAuthCookie(signToken(session), remember !== false);
    return NextResponse.json({ user: session });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normalized,
      passwordHash: await hashPassword(password),
      role: isFirst ? "owner" : "member",
      status: isFirst ? "active" : "pending",
    },
  });

  if (isFirst) {
    const session = { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
    setAuthCookie(signToken(session), remember !== false);
    return NextResponse.json({ user: session });
  }

  // Pending: do NOT log in. Front-end shows "aguarde aprovação".
  return NextResponse.json({ status: "pending" });
}
