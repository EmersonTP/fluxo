// Core ClickUp -> Fluxo import logic, usable from the CLI script and the
// admin "Importar do ClickUp" button. Idempotent (upserts by clickupId).
import { prisma } from "./prisma";

const BASE = "https://api.clickup.com/api/v2";

export type ImportState = {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  log: string[];
  counts: { workspaces: number; spaces: number; lists: number; tasks: number; users: number } | null;
  error: string | null;
};

export const importState: ImportState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  log: [],
  counts: null,
  error: null,
};

function log(msg: string) {
  importState.log.push(msg);
  if (importState.log.length > 200) importState.log.shift();
}

const PALETTE = ["#9250ac", "#ff7e59", "#7fa08a", "#534ab7", "#d85a30", "#3b82f6", "#ef4444", "#14b8a6", "#f59e0b", "#06b6d4"];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function ms(v: any): Date | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Date(n) : null;
}
function mapStatusType(t: string): string {
  if (t === "done") return "done";
  if (t === "closed") return "closed";
  if (t === "open") return "open";
  return "custom";
}

export async function runImport(
  token: string,
  opts: { importComments?: boolean; includeClosed?: boolean; teamIds?: string[] } = {}
) {
  const importComments = !!opts.importComments;
  const includeClosed = opts.includeClosed !== false;
  const teamFilter = opts.teamIds || [];

  async function cu(path: string): Promise<any> {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: token } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 20000));
      return cu(path);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp ${res.status} em ${path}: ${body.slice(0, 160)}`);
    }
    return res.json();
  }

  let activeCompanyId: string | null = null;

  async function ensureUser(member: any, companyId: string | null = activeCompanyId): Promise<string> {
    const cuId = String(member.id);
    const name = member.username || member.email || `Usuário ${cuId}`;
    const email = (member.email || `${cuId}@import.local`).toLowerCase();

    let user = await prisma.user.findUnique({ where: { clickupId: cuId } });
    if (user) {
      user = await prisma.user.update({ where: { id: user.id }, data: { name } });
    } else {
      // Link to an existing account with the same email (e.g. the owner who
      // already registered) instead of failing on the unique email constraint.
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({ where: { id: byEmail.id }, data: { clickupId: cuId } });
      } else {
        user = await prisma.user.create({
          data: {
            clickupId: cuId,
            name,
            email,
            color: member.color || colorFor(cuId),
            role: "member",
            status: "active",
            companyId: companyId || undefined,
          },
        });
      }
    }
    if (companyId && !user.companyId) {
      await prisma.user.update({ where: { id: user.id }, data: { companyId } });
    }
    return user.id;
  }

  const wsCache = new Map<string, string>();
  async function listWorkspaceId(listId: string): Promise<string> {
    if (wsCache.has(listId)) return wsCache.get(listId)!;
    const list = await prisma.list.findUnique({
      where: { id: listId },
      include: { space: true, folder: { include: { space: true } } },
    });
    const wsId = (list?.space?.workspaceId || list?.folder?.space.workspaceId)!;
    wsCache.set(listId, wsId);
    return wsId;
  }

  async function importCommentsFor(taskClickupId: string, taskRowId: string) {
    try {
      const resp = await cu(`/task/${taskClickupId}/comment`);
      for (const c of resp.comments || []) {
        const userId = c.user ? await ensureUser(c.user) : null;
        await prisma.comment.upsert({
          where: { clickupId: String(c.id) },
          update: { text: c.comment_text || "" },
          create: {
            clickupId: String(c.id),
            text: c.comment_text || "",
            taskId: taskRowId,
            userId,
            createdAt: ms(c.date) || new Date(),
          },
        });
      }
    } catch {
      /* ignore */
    }
  }

  async function importList(list: any, parent: { spaceId?: string; folderId?: string }, order: number) {
    let statuses: any[] = list.statuses || [];
    if (!statuses.length) {
      try {
        const full = await cu(`/list/${list.id}`);
        statuses = full.statuses || [];
      } catch {
        statuses = [];
      }
    }

    const listRow = await prisma.list.upsert({
      where: { clickupId: String(list.id) },
      update: { name: list.name },
      create: {
        clickupId: String(list.id),
        name: list.name,
        order,
        spaceId: parent.spaceId || null,
        folderId: parent.folderId || null,
      },
    });

    const statusByName = new Map<string, string>();
    for (const [i, st] of statuses.entries()) {
      const name = st.status;
      const id = `${listRow.id}:${name}`;
      await prisma.status.upsert({
        where: { id },
        update: { color: st.color || "#a3a3a3", order: st.orderindex ?? i, type: mapStatusType(st.type) },
        create: { id, name, color: st.color || "#a3a3a3", order: st.orderindex ?? i, type: mapStatusType(st.type), listId: listRow.id },
      });
      statusByName.set(String(name).toLowerCase(), id);
    }

    const workspaceId = await listWorkspaceId(listRow.id);
    let page = 0;
    let total = 0;
    while (true) {
      const q = `archived=false&page=${page}&subtasks=true&include_closed=${includeClosed}`;
      const resp = await cu(`/list/${list.id}/task?${q}`);
      const tasks: any[] = resp.tasks || [];
      if (!tasks.length) break;

      for (const t of tasks) {
        const statusId = t.status?.status ? statusByName.get(String(t.status.status).toLowerCase()) || null : null;
        const assigneeIds: string[] = [];
        for (const a of t.assignees || []) assigneeIds.push(await ensureUser(a));

        const tagConnect: { id: string }[] = [];
        for (const tag of t.tags || []) {
          const tagRow = await prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId, name: tag.name } },
            update: {},
            create: { name: tag.name, color: tag.tag_bg || tag.tag_fg || "#a3a3a3", workspaceId },
          });
          tagConnect.push({ id: tagRow.id });
        }

        const row = await prisma.task.upsert({
          where: { clickupId: String(t.id) },
          update: {
            name: t.name,
            statusId,
            priority: t.priority?.priority || null,
            dueDate: ms(t.due_date),
            startDate: ms(t.start_date),
            dateClosed: ms(t.date_closed),
            description: t.description || null,
            assignees: { set: assigneeIds.map((id) => ({ id })) },
            tags: { set: tagConnect },
          },
          create: {
            clickupId: String(t.id),
            name: t.name,
            listId: listRow.id,
            statusId,
            priority: t.priority?.priority || null,
            dueDate: ms(t.due_date),
            startDate: ms(t.start_date),
            dateClosed: ms(t.date_closed),
            description: t.description || null,
            order: Number(t.orderindex) || total,
            assignees: { connect: assigneeIds.map((id) => ({ id })) },
            tags: { connect: tagConnect },
          },
        });

        if (importComments) await importCommentsFor(t.id, row.id);
        total++;
      }
      page++;
      if (tasks.length < 100) break;
    }
    if (total) log(`• ${list.name}: ${total} tarefas`);
  }

  // ---- orchestrate ----
  importState.running = true;
  importState.startedAt = Date.now();
  importState.finishedAt = null;
  importState.error = null;
  importState.counts = null;
  importState.log = [];
  log("Iniciando importação...");

  try {
    const teamsResp = await cu("/team");
    let teams: any[] = teamsResp.teams || [];
    if (teamFilter.length) teams = teams.filter((t) => teamFilter.includes(String(t.id)));
    log(`${teams.length} workspace(s) encontrados.`);

    for (const team of teams) {
      log(`Workspace: ${team.name}`);
      const company = await prisma.company.upsert({
        where: { clickupId: String(team.id) },
        update: { name: team.name },
        create: { clickupId: String(team.id), name: team.name },
      });
      activeCompanyId = company.id;

      const ws = await prisma.workspace.upsert({
        where: { clickupId: String(team.id) },
        update: { name: team.name, companyId: company.id },
        create: { clickupId: String(team.id), name: team.name, companyId: company.id },
      });

      for (const m of team.members || []) await ensureUser(m.user || m, company.id);

      const spacesResp = await cu(`/team/${team.id}/space?archived=false`);
      for (const [si, space] of (spacesResp.spaces || []).entries()) {
        log(`  Space: ${space.name}`);
        const spaceRow = await prisma.space.upsert({
          where: { clickupId: String(space.id) },
          update: { name: space.name },
          create: { clickupId: String(space.id), name: space.name, color: space.color || colorFor(space.name), order: si, workspaceId: ws.id },
        });

        const flResp = await cu(`/space/${space.id}/list?archived=false`);
        for (const [li, list] of (flResp.lists || []).entries()) await importList(list, { spaceId: spaceRow.id }, li);

        const foldersResp = await cu(`/space/${space.id}/folder?archived=false`);
        for (const [fi, folder] of (foldersResp.folders || []).entries()) {
          const folderRow = await prisma.folder.upsert({
            where: { clickupId: String(folder.id) },
            update: { name: folder.name },
            create: { clickupId: String(folder.id), name: folder.name, order: fi, spaceId: spaceRow.id },
          });
          for (const [li, list] of (folder.lists || []).entries()) await importList(list, { folderId: folderRow.id }, li);
        }
      }
    }

    const c = await prisma.$transaction([
      prisma.workspace.count(),
      prisma.space.count(),
      prisma.list.count(),
      prisma.task.count(),
      prisma.user.count(),
    ]);
    importState.counts = { workspaces: c[0], spaces: c[1], lists: c[2], tasks: c[3], users: c[4] };
    log(`Concluído: ${c[3]} tarefas, ${c[2]} listas, ${c[1]} spaces, ${c[4]} usuários.`);
  } catch (e: any) {
    importState.error = e.message || String(e);
    log(`ERRO: ${importState.error}`);
  } finally {
    importState.running = false;
    importState.finishedAt = Date.now();
  }
}
