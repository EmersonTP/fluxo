import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const scope = companyScope(user);
  const where = scope === null ? {} : { OR: [{ companyId: scope }, { companyId: null }] };
  const documents = await prisma.document.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, companyId: true, company: { select: { name: true } } },
  });
  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const title = (body.title || "Documento sem título").toString().slice(0, 200);
  const companyId = body.companyId ?? user.companyId ?? null;

  const document = await prisma.document.create({
    data: { title, content: "", companyId, authorId: user.id },
    select: { id: true, title: true, updatedAt: true, companyId: true },
  });
  return NextResponse.json({ document });
}
