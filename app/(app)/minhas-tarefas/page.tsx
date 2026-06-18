"use client";

import { useCallback, useEffect, useState } from "react";
import type { TaskT, Member } from "@/lib/types";
import { TaskCard } from "@/components/TaskCard";
import TaskModal from "@/components/TaskModal";
import { formatDate, isLate } from "@/lib/ui";

type MyTask = TaskT & { list: { id: string; name: string } };
type View = "board" | "list";

const BUCKETS = [
  { id: "late", title: "Atrasadas", dot: "var(--coral)" },
  { id: "open", title: "Em aberto", dot: "var(--roxo)" },
  { id: "done", title: "Concluídas", dot: "var(--sage)" },
];

function bucketOf(t: MyTask): string {
  if (t.dateClosed || t.status?.type === "done" || t.status?.type === "closed") return "done";
  if (isLate(t.dueDate, t.dateClosed)) return "late";
  return "open";
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [view, setView] = useState<View>("board");
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/my-tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/members").then((r) => r.json()).then((d) => setMembers(d.members || []));
    try {
      const saved = localStorage.getItem("fluxo:view:mine");
      if (saved === "board" || saved === "list") setView(saved);
    } catch {}
  }, [load]);

  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem("fluxo:view:mine", v);
    } catch {}
  }

  const filtered = query ? tasks.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())) : tasks;
  const openCount = tasks.filter((t) => bucketOf(t) !== "done").length;
  const lateCount = tasks.filter((t) => bucketOf(t) === "late").length;

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Pessoal</div>
          <div className="fx-title">Minhas tarefas</div>
        </div>
        <div className="fx-search" style={{ position: "relative", marginLeft: "auto" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa…" />
        </div>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
          <button className="fx-filterbtn" style={{ border: "none", borderRadius: 0, ...(view === "board" ? { background: "var(--roxo)", color: "#fff" } : {}) }} onClick={() => changeView("board")}>
            Kanban
          </button>
          <button className="fx-filterbtn" style={{ border: "none", borderRadius: 0, ...(view === "list" ? { background: "var(--roxo)", color: "#fff" } : {}) }} onClick={() => changeView("list")}>
            Lista
          </button>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ padding: "14px 26px 0", display: "flex", gap: 18, fontSize: 13, color: "var(--txt-soft)" }}>
        <span>{openCount} em aberto</span>
        {lateCount > 0 && <span style={{ color: "var(--coral-deep)", fontWeight: 600 }}>{lateCount} atrasada(s)</span>}
        <span>{tasks.length} no total</span>
      </div>

      {loading ? (
        <div style={{ padding: 32, color: "var(--txt-soft)" }}>Carregando...</div>
      ) : view === "board" ? (
        <div className="fx-board scrollbar-thin">
          {BUCKETS.map((b) => {
            const list = filtered.filter((t) => bucketOf(t) === b.id);
            return (
              <div key={b.id} className="fx-col">
                <div className="fx-colhead">
                  <span className="fx-dot" style={{ background: b.dot }} />
                  <span className="fx-coltitle">{b.title}</span>
                  <span className="fx-colcount">{list.length}</span>
                </div>
                <div className="fx-colbody scrollbar-thin">
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={setOpenTask} showList={t.list.name} />
                  ))}
                  {list.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--txt-faint)", fontSize: 13 }}>Nada aqui.</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
          <table className="fx-table">
            <thead>
              <tr>
                <th>Tarefa</th>
                <th style={{ width: 180 }}>Lista</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 100 }}>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => setOpenTask(t.id)}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: "var(--txt-soft)" }}>{t.list.name}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="fx-dot" style={{ background: t.status?.color || "#a3a3a3" }} />
                      {t.status?.name || "—"}
                    </span>
                  </td>
                  <td>
                    <span className={isLate(t.dueDate, t.dateClosed) ? "fx-meta late" : "fx-meta"}>{t.dueDate ? formatDate(t.dueDate) : "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openTask && (
        <TaskModal
          taskId={openTask}
          members={members}
          onClose={() => setOpenTask(null)}
          onUpdated={() => load()}
          onDeleted={() => {
            setOpenTask(null);
            load();
          }}
        />
      )}
    </>
  );
}
