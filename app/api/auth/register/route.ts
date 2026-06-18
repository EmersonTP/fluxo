import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { sendEmail, emailEnabled, emailLayout } from "@/lib/email";

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

  // 1º usuário (owner) entra direto, já verificado.
  if (isFirst) {
    const user = await prisma.user.create({
      data: { name, email: normalized, passwordHash: await hashPassword(password), role: "owner", status: "active", emailVerified: true },
    });
    const session = { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId };
    setAuthCookie(signToken(session), remember !== false);
    return NextResponse.json({ user: session });
  }

  // Domínio autorizado: cria a conta, manda verificar o e-mail e NÃO loga até confirmar.
  // (sem empresa/espaços ainda — depois ele solicita acesso e o admin libera)
  const verifyToken = randomBytes(24).toString("hex");
  await prisma.user.create({
    data: {
      name,
      email: normalized,
      passwordHash: await hashPassword(password),
      role: "member",
      status: "active",
      companyId: null,
      emailVerified: !emailEnabled(), // se não houver provedor de e-mail, não trava o acesso
      verifyToken,
    },
  });

  if (emailEnabled()) {
    const link = `${new URL(req.url).origin}/verificar?token=${verifyToken}`;
    await sendEmail(
      normalized,
      "Confirme seu e-mail · Sandra",
      emailLayout("Confirme seu e-mail", `Olá, ${name}! Confirme seu e-mail para ativar seu acesso à Sandra.`, { label: "Confirmar e-mail", url: link })
    );
    return NextResponse.json({ status: "verify" });
  }

  // Sem provedor de e-mail: entra direto (já marcado como verificado acima)
  const u2 = await prisma.user.findUnique({ where: { email: normalized } });
  const session = { id: u2!.id, name: u2!.name, email: u2!.email, role: u2!.role, companyId: u2!.companyId };
  setAuthCookie(signToken(session), remember !== false);
  return NextResponse.json({ user: session });
}
