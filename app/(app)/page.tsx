import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser, accessibleCompanyIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  const ids = user ? accessibleCompanyIds(user) : null;
  // Membro sem nenhuma empresa não vê nada; usa um id impossível para zerar as contagens.
  const effIds = ids === null ? null : ids.length ? ids : ["__none__"];

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

  const [spaces, lists, tasks, openTasks, myTasks] = await Promise.all([
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
  ]);

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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--r-card)", border: "1px solid var(--line)", padding: "16px 18px" }}>
      <div className="serif" style={{ fontSize: 30, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--txt-soft)" }}>{label}</div>
    </div>
  );
}
