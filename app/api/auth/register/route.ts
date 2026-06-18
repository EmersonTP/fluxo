import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";

// Domínios autorizados para CADASTRO NOVO (quem já existe na base pode entrar de qualquer e-mail)
const ALLOWED_DOMAINS = ["emersonhealth.com.br", "tpeducacao.com.br", "reservaclub.com.br"];

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

  if (existing && existing.status === "disabled") {
    return NextResponse.json({ error: "Esta conta está desativada. Fale com o administrador." }, { status: 403 });
  }

  if (existing && existing.status === "pending") {
    // Conta criada mas ainda não aprovada: define a senha mas NÃO loga
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), name },
    });
    return NextResponse.json({ status: "pending" });
  }

  if (existing) {
    // Membro importado (ativo, sem senha) reivindicando o acesso
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), name, status: "active" },
    });
    const session = { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
    setAuthCookie(signToken(session), remember !== false);
    return NextResponse.json({ user: session });
  }

  // Cadastro NOVO (e-mail desconhecido)
  const domain = normalized.split("@")[1] || "";

  // O 1º usuário do sistema vira owner; os demais precisam ser de um domínio autorizado
  if (!isFirst && !ALLOWED_DOMAINS.includes(domain)) {
    return NextResponse.json(
      { error: "Cadastro permitido apenas para e-mails das empresas do grupo (emersonhealth.com.br, tpeducacao.com.br ou reservaclub.com.br). Fale com o administrador." },
      { status: 403 }
    );
  }

  // Domínio autorizado entra direto (ativo, sem aprovação), porém SEM empresa/espaços ainda:
  // ele entra, não vê nada, e solicita acesso — o admin é quem libera empresa/espaços.
  const user = await prisma.user.create({
    data: {
      name,
      email: normalized,
      passwordHash: await hashPassword(password),
      role: isFirst ? "owner" : "member",
      status: "active",
      companyId: null,
    },
  });

  const session = { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
  setAuthCookie(signToken(session), remember !== false);
  return NextResponse.json({ user: session });
}
