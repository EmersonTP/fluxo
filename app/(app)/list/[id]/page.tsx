"use client";

import { useCallback, useEffect, useState } from "react";
import type { ListDetail, TaskT, Member, StatusT } from "@/lib/types";
import TaskModal from "@/components/TaskModal";
import { TaskCard } from "@/components/TaskCard";
import { formatDate, isLate, priorityMeta } from "@/lib/ui";
import { useToast } from "@/components/Toast";

type View = "board" | "list";

export default function ListPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ListDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [view, setView] = useState<View>("board");
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { toast, Toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`fluxo:view:${params.id}`) || localStorage.getItem("fluxo:view:last");
      if (saved === "board" || saved === "list") setView(saved);
    } catch {}
  }, [params.id]);

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

  const filtered = query ? data.tasks.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())) : data.tasks;

  return (
    <>
      <div className="fx-topbar">
        <div style={{ minWidth: 0, flexShrink: 1 }}>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {data.space?.name}
            {data.folder ? ` / ${data.folder.name}` : ""}
          </div>
          <div className="fx-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.name}</div>
        </div>
        <div className="fx-search" style={{ position: "relative", flex: "1 1 150px", minWidth: 0, maxWidth: 300, marginLeft: "auto" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa…" style={{ width: "100%" }} />
        </div>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", overflow: "hidden", flexShrink: 0 }}>
          <button className="fx-filterbtn" style={{ border: "none", borderRadius: 0, ...(view === "board" ? { background: "var(--roxo)", color: "#fff" } : {}) }} onClick={() => changeView("board")}>
            Kanban
          </button>
          <button className="fx-filterbtn" style={{ border: "none", borderRadius: 0, ...(view === "list" ? { background: "var(--roxo)", color: "#fff" } : {}) }} onClick={() => changeView("list")}>
            Lista
          </button>
        </div>
        <button className="fx-addbtn-top" style={{ flexShrink: 0 }} onClick={addTaskTop}>
          + Tarefa
        </button>
      </div>
      <div className="fx-accent" />

      {view === "board" ? (
        <BoardView list={data} tasks={filtered} onMove={moveTask} onOpen={setOpenTask} onCreated={load} />
      ) : (
        <ListView list={data} tasks={filtered} onOpen={setOpenTask} onCreated={load} />
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
  onMove,
  onOpen,
  onCreated,
}: {
  list: ListDetail;
  tasks: TaskT[];
  onMove: (taskId: string, statusId: string) => void;
  onOpen: (id: string) => void;
  onCreated: () => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const statuses = list.statuses.length ? list.statuses : [{ id: "none", name: "Sem status", color: "#a3a3a3", order: 0, type: "open" }];

  return (
    <div className="fx-board scrollbar-thin">
      {statuses.map((st) => {
        const colTasks = tasks.filter((t) => (t.statusId || "none") === st.id);
        return (
          <div key={st.id} className="fx-col">
            <div className="fx-colhead">
              <span className="fx-dot" style={{ background: st.color }} />
              <span className="fx-coltitle">{st.name}</span>
              <span className="fx-colcount">{colTasks.length}</span>
            </div>
            <div
              className={`fx-colbody scrollbar-thin ${dragOver === st.id ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(st.id);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("taskId");
                setDragOver(null);
                if (taskId && st.id !== "none") onMove(taskId, st.id);
              }}
            >
              {colTasks.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={onOpen} onDragStart={(e) => e.dataTransfer.setData("taskId", t.id)} />
              ))}
            </div>
            {st.id !== "none" && <QuickAdd listId={list.id} statusId={st.id} onCreated={onCreated} />}
          </div>
        );
      })}
    </div>
  );
}

function ListView({ list, tasks, onOpen, onCreated }: { list: ListDetail; tasks: TaskT[]; onOpen: (id: string) => void; onCreated: () => void }) {
  const statuses: StatusT[] = list.statuses.length
    ? list.statuses
    : [{ id: "none", name: "Sem status", color: "#a3a3a3", order: 0, type: "open" }];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 26px 40px" }}>
      {statuses.map((st) => {
        const groupTasks = tasks.filter((t) => (t.statusId || "none") === st.id);
        return (
          <div key={st.id} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <span className="fx-pill" style={{ color: st.color, background: st.color + "20" }}>
                {st.name}
              </span>
              <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{groupTasks.length}</span>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
              {groupTasks.map((t) => {
                const prio = priorityMeta(t.priority);
                const late = isLate(t.dueDate, t.dateClosed);
                return (
                  <div key={t.id} className="fx-listrow" onClick={() => onOpen(t.id)}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {prio && (
                        <span className="fx-pill" style={{ color: prio.fg, background: prio.bg, marginRight: 8 }}>
                          {prio.label}
                        </span>
                      )}
                      {t.name}
                    </span>
                    <div style={{ display: "flex", flexShrink: 0 }}>
                      {t.assignees.slice(0, 3).map((a, i) => (
                        <span key={a.id} className="fx-avatar" title={a.name} style={{ background: a.color, marginLeft: i ? -6 : 0, border: "1.5px solid var(--surface)" }}>
                          {a.name.charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </div>
                    {t.dueDate && (
                      <span className={late ? "fx-meta late" : "fx-meta"} style={{ flexShrink: 0, minWidth: 44, textAlign: "right" }}>
                        {formatDate(t.dueDate)}
                      </span>
                    )}
                  </div>
                );
              })}
              {st.id !== "none" && <QuickAdd listId={list.id} statusId={st.id} onCreated={onCreated} asRow />}
            </div>
          </div>
        );
      })}
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
      placeholder="+ Nova tarefa"
    />
  );
}
