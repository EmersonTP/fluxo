"use client";

import type { TaskT } from "@/lib/types";
import { priorityMeta, isLate, withAlpha, dueMeta } from "@/lib/ui";

export function TaskCard({
  task,
  onOpen,
  onPointerDown,
  showList,
  dragging,
}: {
  task: TaskT;
  onOpen: (id: string) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  showList?: string;
  dragging?: boolean;
}) {
  const prio = priorityMeta(task.priority);
  const bar = task.status?.color || "var(--roxo)";
  const late = isLate(task.dueDate, task.dateClosed);
  const due = dueMeta(task.dueDate, task.dateClosed);

  return (
    <div
      className="fx-card"
      onPointerDown={onPointerDown}
      onClick={onPointerDown ? undefined : () => onOpen(task.id)}
      style={{
        ["--bar" as any]: bar,
        userSelect: "none",
        touchAction: "none",
        cursor: onPointerDown ? "grab" : "pointer",
        ...(dragging ? { opacity: 0.4, borderStyle: "dashed", borderColor: "var(--roxo)" } : {}),
      }}
    >
      <div className="fx-card-title">{task.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {task.status && (
          <span className="fx-pill" style={{ color: task.status.color, background: withAlpha(task.status.color, 0.13) }}>
            {task.status.name}
          </span>
        )}
        {prio && (
          <span className="fx-pill" style={{ color: prio.fg, background: prio.bg }}>
            {prio.label}
          </span>
        )}
        {task.tags.slice(0, 2).map((t) => (
          <span key={t.id} className="fx-pill" style={{ color: t.color, background: withAlpha(t.color, 0.13) }}>
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
        {due && (
          <span className="fx-meta" style={{ color: due.color, fontWeight: late ? 600 : 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
            📅 {due.label}
          </span>
        )}
      </div>
    </div>
  );
}
