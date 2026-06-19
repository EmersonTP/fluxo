import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

// Token pessoal do usuário pro conector do Claude (MCP).
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { mcpToken: true } });
  return NextResponse.json({ token: u?.mcpToken || null });
}

// Gera/rotaciona o token
export async function POST() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const token = "sk_" + randomBytes(24).toString("hex");
  await prisma.user.update({ where: { id: user.id }, data: { mcpToken: token } });
  return NextResponse.json({ token });
}

// Revoga
export async function DELETE() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  await prisma.user.update({ where: { id: user.id }, data: { mcpToken: null } });
  return NextResponse.json({ ok: true });
}
