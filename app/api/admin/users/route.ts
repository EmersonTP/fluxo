import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const user = await requireAdmin();
  if (isResponse(user)) return user;

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      color: true,
      companyId: true,
      company: { select: { id: true, name: true } },
      companyAccess: { select: { id: true } },
    },
  });
  return NextResponse.json({ users });
}

// Admin creates a user directly (already active).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { name, email, password, role, companyId } = await req.json();
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Nome, e-mail e senha obrigatórios." }, { status: 400 });
  }
  const normalized = email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });

  const created = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalized,
      passwordHash: await hashPassword(password),
      role: role || "member",
      status: "active",
      companyId: companyId || null,
    },
    select: { id: true, name: true, email: true, role: true, status: true, companyId: true },
  });
  return NextResponse.json({ user: created });
}
