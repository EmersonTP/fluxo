import { NextResponse } from "next/server";
import { exchangeCode, saveConnection } from "@/lib/gdrive";

export const runtime = "nodejs";

// Google redireciona pra cá com ?code & ?state(=companyId).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code"); const companyId = u.searchParams.get("state") || "";
  const base = process.env.APP_URL || "https://fluxo-production-8ef7.up.railway.app";
  if (!code || !companyId) return NextResponse.redirect(`${base}/financeiro?drive=erro`);
  try {
    const tok = await exchangeCode(code);
    if (!tok.refresh_token) return NextResponse.redirect(`${base}/financeiro?drive=sem_refresh`);
    await saveConnection(companyId, tok.refresh_token);
    return NextResponse.redirect(`${base}/financeiro?drive=ok`);
  } catch { return NextResponse.redirect(`${base}/financeiro?drive=erro`); }
}
