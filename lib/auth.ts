import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE = "fluxo_token";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
};

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signToken(user: SessionUser) {
  return jwt.sign(user, SECRET, { expiresIn: "30d" });
}

export function setAuthCookie(token: string, remember: boolean = true) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // remember = cookie persistente (30 dias); senão, cookie de sessão (some ao fechar o navegador)
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export function clearAuthCookie() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET) as SessionUser;
    // Ensure the user still exists and is allowed in
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.status !== "active") return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  } catch {
    return null;
  }
}

// Returns the companyId to scope queries to, or null when the user is an
// owner/global-admin and should see everything across companies.
export function companyScope(user: { role: string; companyId: string | null }): string | null {
  if (user.role === "owner" || user.role === "admin") return null;
  return user.companyId;
}
