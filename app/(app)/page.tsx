import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser, accessibleCompanyIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  const ids = user ? accessibleCompanyIds(user) : null;
  // Empresa ativa (cookie da troca no rail). Escopa as contagens à empresa selecionada.
  const active = cookies().get("fx_company")?.value || "";
  // ids === null = owner/admin (vê todas). Restringe à empresa ativa se válida pro usuário.
  const allowActive = active && (ids === null || ids.includes(active));
  const ids2 = allowActive ? [active] : ids;
  // Membro sem nenhuma empresa não vê nada; usa um id impossível para zerar as contagens.
  const effIds = ids2 === null ? null : ids2.length ? ids2 : ["__none__"];

  const spaceWhere = effIds === null ? undefined : { workspace: { companyId: { in: effIds } } };
  const listWhere =
    effIds === null
      ? undefined
      : {
          OR: [
            { space: { workspace: { companyId: { in: effIds } } } },
            { folder: { space: { workspace: { companyId: { in: effIds } } } } },
          ],
        };
  const taskWhere = effIds === null ? undefined : { list: listWhere };

  const finWhere: any = effIds === null ? {} : { companyId: { in: effIds } };
  const agora = new Date();
  const [spaces, lists, tasks, openTasks, myTasks, aReceberAberto, vencidoCount, aPagarPend, aConciliar] = await Promise.all([
    prisma.space.count({ where: spaceWhere }),
    prisma.list.count({ where: listWhere }),
    prisma.task.count({ where: taskWhere }),
    prisma.task.count({ where: { dateClosed: null, ...(taskWhere || {}) } }),
    user
      ? prisma.task.findMany({
          where: { assignees: { some: { id: user.id } }, dateClosed: null },
          orderBy: [{ dueDate: "asc" }],
          take: 12,
          include: { status: true, list: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    prisma.receivable.count({ where: { ...finWhere, status: "pendente" } }),
    prisma.receivable.count({ where: { ...finWhere, status: "pendente", vencimento: { lt: agora } } }),
    prisma.paymentRequest.count({ where: { ...finWhere, status: { notIn: ["paga", "recusada", "cancelada"] } } }),
    prisma.bankTransaction.count({ where: { ...finWhere, tipo: "credito", requestId: null, conciliado: false, account: { tipo: { not: "cartao" } } } }),
  ]);
  const temFinanceiro = aReceberAberto + aPagarPend + aConciliar + vencidoCount > 0;

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Visão geral</div>
          <div className="fx-title">Olá, {user?.name?.split(" ")[0]}</div>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 26px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          <Stat label="Spaces" value={spaces} />
          <Stat label="Listas" value={lists} />
          <Stat label="Tarefas" value={tasks} />
          <Stat label="Em aberto" value={openTasks} />
        </div>

        {temFinanceiro && (
          <div style={{ marginBottom: 28 }}>
            <div className="serif" style={{ fontSize: 19, fontWeight: 500, marginBottom: 12 }}>Financeiro — o que precisa de você</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <FinCard href="/financeiro" label="Recebimentos a conciliar" value={aConciliar} cor={aConciliar ? "#b5781f" : "#0f6b50"} hint="Contas a Receber → A conciliar" />
              <FinCard href="/financeiro" label="A pagar / aprovar" value={aPagarPend} cor={aPagarPend ? "#274b6d" : "#0f6b50"} hint="Solicitações em aberto" />
              <FinCard href="/financeiro" label="Recebíveis vencidos" value={vencidoCount} cor={vencidoCount ? "#a8332c" : "#0f6b50"} hint="Cobrar / conciliar" />
              <FinCard href="/financeiro" label="A receber (em aberto)" value={aReceberAberto} cor="var(--txt)" hint="Títulos pendentes" />
            </div>
          </div>
        )}

        <div className="serif" style={{ fontSize: 19, fontWeight: 500, marginBottom: 12 }}>
          Minhas tarefas
        </div>
        {myTasks.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--txt-soft)" }}>
            Nenhuma tarefa atribuída a você. Escolha uma lista na barra lateral para começar.
          </p>
        ) : (
          <div style={{ background: "var(--surface)", borderRadius: "var(--r-card)", border: "1px solid var(--line)", overflow: "hidden" }}>
            {myTasks.map((t: (typeof myTasks)[number]) => (
              <Link
                key={t.id}
                href={`/list/${t.list.id}?task=${t.id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--line)", textDecoration: "none", color: "var(--txt)" }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.status?.color || "#a3a3a3", flex: "0 0 auto" }} />
                <span style={{ flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{t.list.name}</span>
                {t.dueDate && <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>{new Date(t.dueDate).toLocaleDateString("pt-BR")}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function FinCard({ href, label, value, cor, hint }: { href: string; label: string; value: number; cor: string; hint: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "var(--txt)", background: "var(--surface)", borderRadius: "var(--r-card)", border: "1px solid var(--line)", padding: "14px 16px", display: "block" }}>
      <div style={{ fontSize: 11.5, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div className="serif" style={{ fontSize: 28, fontWeight: 600, color: cor }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{hint} →</div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--r-card)", border: "1px solid var(--line)", padding: "16px 18px" }}>
      <div className="serif" style={{ fontSize: 30, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--txt-soft)" }}>{label}</div>
    </div>
  );
}
