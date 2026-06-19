"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ListDetail, TaskT, Member, StatusT } from "@/lib/types";
import TaskModal from "@/components/TaskModal";
import { TaskCard } from "@/components/TaskCard";
import { formatDate, isLate } from "@/lib/ui";
import { useToast } from "@/components/Toast";

type View = "board" | "list" | "calendar";
type SortBy = "manual" | "due" | "priority" | "name";

const PRIO_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function ListPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ListPageInner params={params} />
    </Suspense>
  );
}

function ListPageInner({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [view, setView] = useState<View>("board");
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState("");
  const { toast, Toast } = useToast();

  async function renameList() {
    setEditingTitle(false);
    const v = titleVal.trim();
    if (!data || !v || v === data.name) return;
    setData((prev) => (prev ? { ...prev, name: v } : prev));
    await fetch(`/api/lists/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: v }),
    });
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`fluxo:view:${params.id}`) || localStorage.getItem("fluxo:view:last");
      if (saved === "board" || saved === "list" || saved === "calendar") setView(saved);
    } catch {}
  }, [params.id]);

  // Abrir tarefa vinda da busca global (?task=...), inclusive na mesma lista
  useEffect(() => {
    const t = searchParams.get("task");
    if (t) setOpenTask(t);
  }, [searchParams]);

  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(`fluxo:view:${params.id}`, v);
      localStorage.setItem("fluxo:view:last", v);
    } catch {}
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/lists/${params.id}`)
      .then((r) => r.json())
      .then((d) => setData(d.list))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    load();
    fetch("/api/members").then((r) => r.json()).then((d) => setMembers(d.members || []));
  }, [load]);

  function patchTaskLocal(updated: TaskT) {
    setData((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) } : prev));
  }
  function removeTaskLocal(id: string) {
    setData((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) } : prev));
  }

  async function moveTask(taskId: string, statusId: string) {
    let label = "";
    setData((prev) => {
      if (!prev) return prev;
      const st = prev.statuses.find((s) => s.id === statusId) || null;
      label = st?.name || "";
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, statusId, status: st } : t)) };
    });
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId }),
    });
    toast(`Tarefa movida para "${label}"`);
  }

  async function setPriority(taskId: string, priority: string | null) {
    setData((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, priority: priority || undefined } : t)) } : prev
    );
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
  }

  async function patchTaskFields(taskId: string, body: Record<string, unknown>, optimistic: Partial<TaskT>) {
    setData((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...optimistic } : t)) } : prev));
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function reorderColumn(statusId: string, orderedIds: string[]) {
    const st = data?.statuses.find((s) => s.id === statusId) || null;
    setData((prev) => {
      if (!prev) return prev;
      const idxMap = new Map(orderedIds.map((id, i) => [id, i] as const));
      const tasks = prev.tasks
        .map((t) => (idxMap.has(t.id) ? { ...t, statusId, status: st, order: (idxMap.get(t.id) as number) * 100 } : t))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { ...prev, tasks };
    });
    await fetch(`/api/lists/${params.id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId, orderedIds }),
    });
  }

  async function addTaskTop() {
    if (!data) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: data.id, statusId: data.statuses[0]?.id, name: "Nova tarefa" }),
    });
    const d = await res.json();
    if (d.task) {
      await load();
      setOpenTask(d.task.id);
    }
  }

  if (loading && !data) return <div style={{ padding: 32, color: "var(--txt-soft)" }}>Carregando...</div>;
  if (!data) return <div style={{ padding: 32, color: "var(--txt-soft)" }}>Lista não encontrada.</div>;

  let filtered = data.tasks;
  if (query) filtered = filtered.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  if (filterAssignee) filtered = filtered.filter((t) => t.assignees.some((a) => a.id === filterAssignee));
  if (filterPriority) filtered = filtered.filter((t) => (t.priority || "") === filterPriority);
  if (sortBy !== "manual") {
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "priority") return (PRIO_RANK[a.priority || ""] ?? 9) - (PRIO_RANK[b.priority || ""] ?? 9);
      if (sortBy === "due") {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      }
      return 0;
    });
  }
  const filtersActive = !!(filterAssignee || filterPriority || sortBy !== "manual");

  return (
    <>
      <div className="fx-topbar">
        <div style={{ minWidth: 0, flexShrink: 1 }}>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {data.space?.name}
            {data.folder ? ` / ${data.folder.name}` : ""}
          </div>
          {editingTitle ? (
            <input
              autoFocus
              className="fx-input fx-title"
              style={{ padding: "2px 8px", maxWidth: 360 }}
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") renameList(); if (e.key === "Escape") setEditingTitle(false); }}
              onBlur={renameList}
            />
          ) : (
            <div
              className="fx-title"
              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "text" }}
              onDoubleClick={() => { setTitleVal(data.name); setEditingTitle(true); }}
              title="Duplo-clique para renomear"
            >
              {data.name}
            </div>
          )}
        </div>
        <div className="fx-search" style={{ position: "relative", flex: "1 1 150px", minWidth: 0, maxWidth: 300, marginLeft: "auto" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa…" style={{ width: "100%" }} />
        </div>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", overflow: "hidden", flexShrink: 0 }}>
          {([["board", "Kanban"], ["list", "Lista"], ["calendar", "Calendário"]] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              className="fx-filterbtn"
              style={{ border: "none", borderRadius: 0, ...(view === v ? { background: "var(--roxo)", color: "#fff" } : {}) }}
              onClick={() => changeView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="fx-addbtn-top" style={{ flexShrink: 0 }} onClick={addTaskTop}>
          + Tarefa
        </button>
      </div>
      <div className="fx-accent" />

      {/* Filtros e ordenação */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 26px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>Filtros</span>
        <select className="fx-select" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
          <option value="">Todos responsáveis</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select className="fx-select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">Toda prioridade</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="normal">Normal</option>
          <option value="low">Baixa</option>
        </select>
        <span style={{ width: 1, height: 18, background: "var(--line)" }} />
        <span style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>Ordenar</span>
        <select className="fx-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          <option value="manual">Manual</option>
          <option value="due">Prazo</option>
          <option value="priority">Prioridade</option>
          <option value="name">Nome (A-Z)</option>
        </select>
        {filtersActive && (
          <button
            className="fx-filterbtn"
            onClick={() => { setFilterAssignee(""); setFilterPriority(""); setSortBy("manual"); }}
            style={{ marginLeft: "auto" }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {view === "board" ? (
        <BoardView list={data} tasks={filtered} onReorder={reorderColumn} onOpen={setOpenTask} onCreated={load} />
      ) : view === "list" ? (
        <ListView list={data} tasks={filtered} members={members} onOpen={setOpenTask} onCreated={load} onMove={moveTask} onSetPriority={setPriority} onPatch={patchTaskFields} />
      ) : (
        <CalendarView tasks={filtered} onOpen={setOpenTask} />
      )}

      {openTask && (
        <TaskModal
          taskId={openTask}
          members={members}
          onClose={() => setOpenTask(null)}
          onUpdated={patchTaskLocal}
          onDeleted={(id) => {
            removeTaskLocal(id);
            setOpenTask(null);
          }}
        />
      )}
      <Toast />
    </>
  );
}

function BoardView({
  list,
  tasks,
  onReorder,
  onOpen,
  onCreated,
}: {
  list: ListDetail;
  tasks: TaskT[];
  onReorder: (statusId: string, orderedIds: string[]) => void;
  onOpen: (id: string) => void;
  onCreated: () => void;
}) {
  const statuses = list.statuses.length ? list.statuses : [{ id: "none", name: "Sem status", color: "#a3a3a3", order: 0, type: "open" }];
  const [drag, setDrag] = useState<{ taskId: string; name: string; color: string; x: number; y: number } | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const overRef = useRef<string | null>(null);
  const idxRef = useRef<number>(0);

  function handleCardPointerDown(e: React.PointerEvent, task: TaskT) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const startX = e.clientX;
    const startY = e.clientY;
    const color = task.status?.color || "#9250ac";
    let started = false;
    function move(ev: PointerEvent) {
      if (!started && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        started = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      if (started) {
        ev.preventDefault();
        setDrag({ taskId: task.id, name: task.name, color, x: ev.clientX, y: ev.clientY });
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const col = el?.closest("[data-status]") as HTMLElement | null;
        const sid = col?.getAttribute("data-status") || null;
        overRef.current = sid;
        setOverCol(sid);
        // posição de inserção entre os cartões visíveis (já sem o que está sendo arrastado)
        let idx = 0;
        if (col) {
          const cards = Array.from(col.querySelectorAll("[data-card-id]")) as HTMLElement[];
          idx = cards.length;
          for (let i = 0; i < cards.length; i++) {
            const r = cards[i].getBoundingClientRect();
            if (ev.clientY < r.top + r.height / 2) { idx = i; break; }
          }
        }
        idxRef.current = idx;
        setOverIdx(idx);
      }
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (started) {
        const target = overRef.current;
        const idx = idxRef.current;
        setDrag(null);
        setOverCol(null);
        setOverIdx(null);
        if (target && target !== "none") {
          const ids = tasks.filter((t) => (t.statusId || "none") === target && t.id !== task.id).map((t) => t.id);
          ids.splice(Math.min(idx, ids.length), 0, task.id);
          onReorder(target, ids);
        }
      } else {
        onOpen(task.id);
      }
      overRef.current = null;
    }
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  return (
    <div className="fx-board scrollbar-thin">
      {statuses.map((st) => {
        const colTasks = tasks.filter((t) => (t.statusId || "none") === st.id);
        const visible = drag ? colTasks.filter((t) => t.id !== drag.taskId) : colTasks;
        const lineAt = drag && overCol === st.id ? (overIdx ?? visible.length) : -1;
        return (
          <div key={st.id} className="fx-col" data-status={st.id}>
            <div className="fx-colhead">
              <span className="fx-dot" style={{ background: st.color }} />
              <span className="fx-coltitle">{st.name}</span>
              <span className="fx-colcount">{colTasks.length}</span>
            </div>
            <div className={`fx-colbody scrollbar-thin ${drag && overCol === st.id ? "drag-over" : ""}`}>
              {visible.map((t, i) => (
                <div key={t.id} data-card-id={t.id}>
                  {lineAt === i && <div className="fx-dropline" style={{ background: st.color }} />}
                  <TaskCard task={t} onOpen={onOpen} onPointerDown={(e) => handleCardPointerDown(e, t)} />
                </div>
              ))}
              {lineAt === visible.length && <div className="fx-dropline" style={{ background: st.color }} />}
              {drag && overCol === st.id && visible.length === 0 && (
                <div style={{ border: `2px dashed ${st.color}`, borderRadius: 10, padding: "14px 12px", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: st.color, background: st.color + "10" }}>
                  Soltar aqui
                </div>
              )}
            </div>
            {st.id !== "none" && <QuickAdd listId={list.id} statusId={st.id} onCreated={onCreated} />}
          </div>
        );
      })}
      {drag && (
        <div
          style={{
            position: "fixed",
            left: drag.x + 12,
            top: drag.y - 6,
            zIndex: 1000,
            pointerEvents: "none",
            width: 240,
            background: "var(--surface)",
            borderRadius: 10,
            borderLeft: `4px solid ${drag.color}`,
            border: "1px solid var(--line)",
            borderLeftWidth: 4,
            borderLeftColor: drag.color,
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--txt)",
            boxShadow: "0 12px 28px rgba(0,0,0,.22)",
            transform: "rotate(2.5deg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {drag.name}
        </div>
      )}
    </div>
  );
}

const PRIORITIES = [
  { value: "urgent", label: "Urgente", color: "#e5484d" },
  { value: "high", label: "Alta", color: "#ff7e59" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "low", label: "Baixa", color: "#9aa0a6" },
];

function ListView({
  list,
  tasks,
  members,
  onOpen,
  onCreated,
  onMove,
  onSetPriority,
  onPatch,
}: {
  list: ListDetail;
  tasks: TaskT[];
  members: Member[];
  onOpen: (id: string) => void;
  onCreated: () => void;
  onMove: (taskId: string, statusId: string) => void;
  onSetPriority: (taskId: string, priority: string | null) => void;
  onPatch: (taskId: string, body: Record<string, unknown>, optimistic: Partial<TaskT>) => void;
}) {
  const statuses: StatusT[] = list.statuses.length
    ? list.statuses
    : [{ id: "none", name: "Sem status", color: "#a3a3a3", order: 0, type: "open" }];
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  async function createGroup() {
    if (!groupName.trim()) return;
    await fetch(`/api/lists/${list.id}/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName.trim() }),
    });
    setGroupName("");
    setAddingGroup(false);
    onCreated();
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px 48px" }}>
      {statuses.map((st) => {
        const groupTasks = tasks.filter((t) => (t.statusId || "none") === st.id);
        const isCollapsed = collapsed[st.id];
        return (
          <div key={st.id} className="fx-lt-group">
            <div className="fx-lt-grouphead">
              <button
                className="fx-lt-caret"
                onClick={() => setCollapsed((c) => ({ ...c, [st.id]: !c[st.id] }))}
                style={{ transform: isCollapsed ? "rotate(-90deg)" : "none" }}
              >
                ▾
              </button>
              <GroupTitle st={st} onCreated={onCreated} />
              <span style={{ fontSize: 12, color: "var(--txt-faint)", fontWeight: 600 }}>{groupTasks.length}</span>
            </div>
            {!isCollapsed && (
              <div className="fx-lt-table">
                <div className="fx-lt-headrow">
                  <span />
                  <span />
                  <span>Tarefa</span>
                  <span>Resp.</span>
                  <span>Prazo</span>
                  <span className="fx-lt-prio">Prioridade</span>
                </div>
                {groupTasks.map((t) => (
                  <TreeRow
                    key={t.id}
                    task={t}
                    depth={0}
                    listId={list.id}
                    statuses={statuses}
                    members={members}
                    onOpen={onOpen}
                    onCreated={onCreated}
                    onTopMove={onMove}
                    onTopSetPriority={onSetPriority}
                    onTopPatch={onPatch}
                  />
                ))}
                {groupTasks.length === 0 && (
                  <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--txt-faint)" }}>Nenhuma tarefa neste grupo.</div>
                )}
                {st.id !== "none" && <QuickAdd listId={list.id} statusId={st.id} onCreated={onCreated} asRow />}
              </div>
            )}
          </div>
        );
      })}
      {addingGroup ? (
        <input
          autoFocus
          className="fx-input"
          style={{ maxWidth: 260 }}
          placeholder="Nome do grupo (status)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createGroup();
            if (e.key === "Escape") {
              setAddingGroup(false);
              setGroupName("");
            }
          }}
          onBlur={() => {
            setAddingGroup(false);
            setGroupName("");
          }}
        />
      ) : (
        <button className="fx-btn" onClick={() => setAddingGroup(true)}>
          + Adicionar grupo
        </button>
      )}
    </div>
  );
}

function GroupTitle({ st, onCreated }: { st: StatusT; onCreated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(st.name);
  async function save() {
    if (name.trim() && name !== st.name) {
      await fetch(`/api/statuses/${st.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      onCreated();
    }
    setEditing(false);
  }
  if (editing && st.id !== "none") {
    return (
      <input
        autoFocus
        className="fx-input"
        style={{ maxWidth: 200, fontSize: 12.5, padding: "3px 8px" }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={save}
      />
    );
  }
  return (
    <button
      className="fx-lt-statuspill"
      style={{ color: "#fff", background: st.color, cursor: st.id !== "none" ? "text" : "default" }}
      onClick={() => st.id !== "none" && setEditing(true)}
      title={st.id !== "none" ? "Clique para renomear" : ""}
    >
      {st.name}
    </button>
  );
}

function StatusDot({ color, done, size = 16, onClick, title }: { color: string; done?: boolean; size?: number; onClick?: (e: React.MouseEvent) => void; title?: string }) {
  return (
    <button
      className="fx-lt-statusdot"
      style={{ color, background: done ? color : "transparent", width: size, height: size, cursor: onClick ? "pointer" : "default" }}
      title={title}
      onClick={onClick}
    >
      {done && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

function TreeRow({
  task: initial,
  depth,
  listId,
  statuses,
  members,
  onOpen,
  onCreated,
  onTopMove,
  onTopSetPriority,
  onTopPatch,
}: {
  task: any;
  depth: number;
  listId: string;
  statuses: StatusT[];
  members: Member[];
  onOpen: (id: string) => void;
  onCreated: () => void;
  onTopMove?: (taskId: string, statusId: string) => void;
  onTopSetPriority?: (taskId: string, priority: string | null) => void;
  onTopPatch?: (taskId: string, body: Record<string, unknown>, optimistic: Partial<TaskT>) => void;
}) {
  const [task, setTask] = useState<any>(initial);
  useEffect(() => setTask(initial), [initial]);
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [subName, setSubName] = useState("");
  const [menu, setMenu] = useState<null | "status" | "priority" | "assignee" | "due">(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(task.name);

  const late = isLate(task.dueDate, task.dateClosed);
  const subCount = task._count?.subtasks ?? (children?.length || 0);
  const curStatus = statuses.find((s) => s.id === (task.statusId || "none"));
  const dotColor = curStatus?.color || "#a3a3a3";
  const done = curStatus?.type === "done" || curStatus?.type === "closed";
  const prio = PRIORITIES.find((p) => p.value === task.priority);
  const indent = { ["--indent" as any]: depth * 22 + "px" };

  async function loadChildren() {
    const d = await fetch(`/api/tasks/${task.id}`).then((r) => r.json());
    setChildren(d.task?.subtasks || []);
  }
  async function toggle() {
    const nx = !expanded;
    setExpanded(nx);
    if (nx && children === null) await loadChildren();
  }
  function changeStatus(sid: string) {
    setMenu(null);
    const st = statuses.find((s) => s.id === sid) || null;
    if (depth === 0 && onTopMove) {
      onTopMove(task.id, sid);
    } else {
      setTask((t: any) => ({ ...t, statusId: sid, status: st }));
      fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusId: sid }) });
    }
  }
  function changePriority(p: string | null) {
    setMenu(null);
    if (depth === 0 && onTopSetPriority) {
      onTopSetPriority(task.id, p);
    } else {
      setTask((t: any) => ({ ...t, priority: p || undefined }));
      fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: p }) });
    }
  }
  function applyFields(body: Record<string, unknown>, optimistic: Partial<TaskT>) {
    if (depth === 0 && onTopPatch) {
      onTopPatch(task.id, body, optimistic);
    } else {
      setTask((t: any) => ({ ...t, ...optimistic }));
      fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
  }
  function toggleAssignee(id: string) {
    const has = (task.assignees || []).some((a: any) => a.id === id);
    const ids = has ? task.assignees.filter((a: any) => a.id !== id).map((a: any) => a.id) : [...(task.assignees || []).map((a: any) => a.id), id];
    applyFields({ assigneeIds: ids }, { assignees: members.filter((m) => ids.includes(m.id)) });
  }
  function changeDue(dateStr: string) {
    applyFields({ dueDate: dateStr || null }, { dueDate: dateStr || null });
  }
  function renameTask() {
    setEditingName(false);
    const v = nameVal.trim();
    if (v && v !== task.name) applyFields({ name: v }, { name: v });
  }
  async function addSub() {
    if (!subName.trim()) {
      setAdding(false);
      return;
    }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, name: subName.trim(), parentId: task.id }),
    });
    const d = await res.json();
    if (d.task) {
      setChildren((c) => [...(c || []), d.task]);
      setTask((t: any) => ({ ...t, _count: { ...(t._count || {}), subtasks: (t._count?.subtasks || 0) + 1 } }));
      setExpanded(true);
    }
    setSubName("");
    setAdding(false);
    onCreated();
  }

  return (
    <div>
      <div className="fx-lt-row" style={indent} onClick={() => onOpen(task.id)}>
        <button onClick={(e) => { e.stopPropagation(); toggle(); }} className="fx-lt-caret" title="Subtarefas">
          {expanded ? "▾" : "▸"}
        </button>

        <div style={{ position: "relative", justifySelf: "center" }}>
          <StatusDot color={dotColor} done={done} title={curStatus?.name || "Status"} onClick={(e) => { e.stopPropagation(); setMenu(menu === "status" ? null : "status"); }} />
          {menu === "status" && (
            <>
              <div onClick={(e) => { e.stopPropagation(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
              <div className="fx-popover" style={{ top: 24, left: 0 }} onClick={(e) => e.stopPropagation()}>
                {statuses.filter((s) => s.id !== "none").map((s) => (
                  <button key={s.id} onClick={() => changeStatus(s.id)}>
                    <span style={{ width: 13, height: 13, borderRadius: "50%", background: s.color, flexShrink: 0, border: "1px solid rgba(0,0,0,.12)" }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="fx-lt-name">
          {editingName ? (
            <input
              autoFocus
              className="fx-input"
              style={{ fontSize: 13.5, padding: "2px 6px", width: "100%" }}
              value={nameVal}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") renameTask();
                if (e.key === "Escape") setEditingName(false);
              }}
              onBlur={renameTask}
            />
          ) : (
            <>
              <span
                onDoubleClick={(e) => { e.stopPropagation(); setNameVal(task.name); setEditingName(true); }}
                title="Duplo-clique para renomear"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}
              >
                {task.name}
              </span>
              {subCount > 0 && <span style={{ fontSize: 11, color: "var(--txt-faint)", flexShrink: 0 }}>⤷ {subCount}</span>}
            </>
          )}
        </span>

        <span className="fx-lt-cell" style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenu(menu === "assignee" ? null : "assignee"); }}
            style={{ display: "flex", alignItems: "center", border: "none", background: "transparent", cursor: "pointer", padding: 0, minHeight: 22, minWidth: 24 }}
            title="Atribuir"
          >
            {(task.assignees || []).length === 0 ? (
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px dashed var(--line)", color: "var(--txt-faint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>+</span>
            ) : (
              (task.assignees || []).slice(0, 3).map((a: any, i: number) => (
                <span key={a.id} className="fx-avatar" title={a.name} style={{ width: 22, height: 22, background: a.color, marginLeft: i ? -6 : 0, border: "1.5px solid var(--surface)" }}>
                  {a.name.charAt(0).toUpperCase()}
                </span>
              ))
            )}
          </button>
          {menu === "assignee" && (
            <>
              <div onClick={(e) => { e.stopPropagation(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
              <div className="fx-popover" style={{ top: 26, left: 0, minWidth: 200, maxHeight: 240, overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <input className="fx-input" placeholder="Buscar pessoa…" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} style={{ marginBottom: 6 }} autoFocus />
                {members.filter((m) => m.name.toLowerCase().includes(assignSearch.toLowerCase())).map((m) => {
                  const active = (task.assignees || []).some((a: any) => a.id === m.id);
                  return (
                    <button key={m.id} onClick={() => toggleAssignee(m.id)}>
                      <span className="fx-avatar" style={{ width: 20, height: 20, fontSize: 9, background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      {active && <span style={{ color: "var(--roxo)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </span>

        <span className="fx-lt-cell" style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenu(menu === "due" ? null : "due"); }}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 12, fontFamily: "inherit", color: late ? "var(--coral-deep)" : "var(--txt-soft)", fontWeight: late ? 600 : 400 }}
            title="Definir prazo"
          >
            {task.dueDate ? formatDate(task.dueDate) : <span style={{ opacity: 0.35 }}>—</span>}
          </button>
          {menu === "due" && (
            <>
              <div onClick={(e) => { e.stopPropagation(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
              <div className="fx-popover" style={{ top: 26, right: 0, minWidth: 180 }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="date"
                  className="fx-input"
                  value={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                  onChange={(e) => { changeDue(e.target.value); setMenu(null); }}
                  autoFocus
                />
                {task.dueDate && (
                  <button onClick={() => { changeDue(""); setMenu(null); }} style={{ marginTop: 4 }}>
                    <span style={{ opacity: 0.5 }}>✕</span> Limpar prazo
                  </button>
                )}
              </div>
            </>
          )}
        </span>

        <span className="fx-lt-cell fx-lt-prio" style={{ position: "relative" }}>
          <button className="fx-lt-flag" style={{ color: prio ? prio.color : "var(--txt-faint)", background: prio ? prio.color + "1c" : "transparent" }} onClick={(e) => { e.stopPropagation(); setMenu(menu === "priority" ? null : "priority"); }}>
            <span>⚑</span>
            {prio ? prio.label : <span style={{ opacity: 0.5 }}>—</span>}
          </button>
          {menu === "priority" && (
            <>
              <div onClick={(e) => { e.stopPropagation(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
              <div className="fx-popover" style={{ top: 26, right: 0 }} onClick={(e) => e.stopPropagation()}>
                {PRIORITIES.map((p) => (
                  <button key={p.value} onClick={() => changePriority(p.value)}>
                    <span style={{ color: p.color }}>⚑</span>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => changePriority(null)}>
                  <span style={{ opacity: 0.5 }}>⚑</span>
                  Limpar
                </button>
              </div>
            </>
          )}
        </span>
      </div>

      {expanded && (
        <div>
          {(children || []).map((c) => (
            <TreeRow key={c.id} task={c} depth={depth + 1} listId={listId} statuses={statuses} members={members} onOpen={onOpen} onCreated={onCreated} />
          ))}
          {adding ? (
            <div className="fx-lt-row" style={{ ["--indent" as any]: (depth + 1) * 22 + "px" }}>
              <span className="fx-lt-caret" />
              <span style={{ justifySelf: "center", color: "var(--txt-faint)" }}>+</span>
              <input
                autoFocus
                className="fx-input"
                style={{ fontSize: 13, padding: "3px 8px", gridColumn: "3 / -1" }}
                placeholder="Nome da subtarefa"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSub();
                  if (e.key === "Escape") { setAdding(false); setSubName(""); }
                }}
                onBlur={addSub}
              />
            </div>
          ) : (
            <button
              className="fx-lt-row"
              style={{ ["--indent" as any]: (depth + 1) * 22 + "px", color: "var(--txt-faint)", border: "none", borderTop: "1px solid var(--line)", cursor: "pointer", textAlign: "left", font: "inherit", background: "transparent" }}
              onClick={() => setAdding(true)}
            >
              <span className="fx-lt-caret" />
              <span style={{ justifySelf: "center" }}>+</span>
              <span className="fx-lt-name" style={{ color: "var(--txt-faint)", fontSize: 13 }}>Adicionar subtarefa</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarView({ tasks, onOpen }: { tasks: TaskT[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const byDay: Record<string, TaskT[]> = {};
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (byDay[key] ||= []).push(t);
  }
  const noDue = tasks.filter((t) => !t.dueDate).length;
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px 40px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="fx-filterbtn" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
        <div className="serif" style={{ fontSize: 18, fontWeight: 500, textTransform: "capitalize", minWidth: 170 }}>{monthLabel}</div>
        <button className="fx-filterbtn" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
        <button className="fx-filterbtn" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hoje</button>
        {noDue > 0 && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--txt-faint)" }}>{noDue} tarefa(s) sem prazo</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderLeft: "1px solid var(--line)", borderTop: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {weekdays.map((w) => (
          <div key={w} style={{ fontSize: 11, fontWeight: 600, color: "var(--txt-faint)", textTransform: "uppercase", padding: "7px 8px", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--col)" }}>{w}</div>
        ))}
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = d.toDateString() === today.toDateString();
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayTasks = byDay[key] || [];
          return (
            <div key={i} style={{ minHeight: 98, borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "5px 6px", background: inMonth ? "var(--surface)" : "var(--col)", opacity: inMonth ? 1 : 0.5, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 11.5, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : "var(--txt-soft)", background: isToday ? "var(--roxo)" : "transparent", borderRadius: 999, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
                {d.getDate()}
              </div>
              {dayTasks.slice(0, 4).map((t) => {
                const c = t.status?.color || "#a3a3a3";
                return (
                  <button key={t.id} onClick={() => onOpen(t.id)} title={t.name} style={{ display: "flex", alignItems: "center", gap: 5, textAlign: "left", border: "none", background: c + "20", color: "var(--txt)", borderRadius: 5, padding: "2px 6px", fontSize: 11, cursor: "pointer", overflow: "hidden" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  </button>
                );
              })}
              {dayTasks.length > 4 && <span style={{ fontSize: 10.5, color: "var(--txt-faint)" }}>+{dayTasks.length - 4} mais</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickAdd({ listId, statusId, onCreated, asRow }: { listId: string; statusId?: string; onCreated: () => void; asRow?: boolean }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setAdding(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, statusId, name }),
    });
    setName("");
    setAdding(false);
    onCreated();
  }

  return (
    <input
      className={asRow ? "fx-addrow" : "fx-addbtn"}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && submit()}
      disabled={adding}
      placeholder="+ Adicionar tarefa"
    />
  );
}
