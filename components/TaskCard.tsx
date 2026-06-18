"use client";

import type { TaskT } from "@/lib/types";
import { priorityMeta, formatDate, isLate } from "@/lib/ui";

export function TaskCard({
  task,
  onOpen,
  onMouseDown,
  showList,
}: {
  task: TaskT;
  onOpen: (id: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  showList?: string;
}) {
  const prio = priorityMeta(task.priority);
  const bar = task.status?.color || "var(--roxo)";
  const late = isLate(task.dueDate, task.dateClosed);

  return (
    <div
      className="fx-card"
      onMouseDown={onMouseDown}
      onClick={onMouseDown ? undefined : () => onOpen(task.id)}
      style={{ ["--bar" as any]: bar, userSelect: "none" }}
    >
      <div className="fx-card-title">{task.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {task.status && (
          <span className="fx-pill" style={{ color: task.status.color, background: "rgba(146,80,172,.10)" }}>
            {task.status.name}
          </span>
        )}
        {prio && (
          <span className="fx-pill" style={{ color: prio.fg, background: prio.bg }}>
            {prio.label}
          </span>
        )}
        {task.tags.slice(0, 2).map((t) => (
          <span key={t.id} className="fx-pill" style={{ color: t.color, background: "rgba(51,51,51,.05)" }}>
            {t.name}
          </span>
        ))}
      </div>
      <div className="fx-card-foot" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
        <div style={{ display: "flex", marginLeft: 0 }}>
          {task.assignees.slice(0, 3).map((a, i) => (
            <span key={a.id} className="fx-avatar" title={a.name} style={{ background: a.color, marginLeft: i ? -6 : 0, border: "1.5px solid var(--surface)" }}>
              {a.name.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
        {showList && <span className="fx-meta" style={{ marginLeft: 2 }}>{showList}</span>}
        <span className="fx-meta" style={{ marginLeft: "auto" }}>
          {task._count && task._count.comments > 0 ? `💬 ${task._count.comments}  ` : ""}
        </span>
        {task.dueDate && (
          <span className={`fx-meta ${late ? "late" : ""}`}>{late ? "venceu " : ""}{formatDate(task.dueDate)}</span>
        )}
      </div>
    </div>
  );
}
