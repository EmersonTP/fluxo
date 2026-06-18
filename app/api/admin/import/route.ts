import { NextResponse } from "next/server";
import { requireAdmin, isResponse } from "@/lib/api";
import { runImport, importState } from "@/lib/clickup-import";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const user = await requireAdmin();
  if (isResponse(user)) return user;
  return NextResponse.json({ state: importState });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (isResponse(user)) return user;

  if (importState.running) {
    return NextResponse.json({ error: "Importação já está em andamento." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const token = body.token || process.env.CLICKUP_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Informe o token de API do ClickUp." }, { status: 400 });
  }

  // Fire and forget — progress is tracked in importState and polled via GET.
  runImport(token, {
    importComments: !!body.importComments,
    includeClosed: body.includeClosed !== false,
  });

  return NextResponse.json({ started: true });
}
