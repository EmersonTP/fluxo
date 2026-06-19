import { NextResponse } from "next/server";
import { requireUser, isResponse } from "@/lib/api";
import { financeCompanies } from "@/lib/finance";

// Empresas que o usuário pode operar no módulo financeiro (para o seletor).
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companies = await financeCompanies(user);
  return NextResponse.json({ companies });
}
