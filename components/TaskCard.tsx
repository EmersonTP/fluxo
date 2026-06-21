"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TaskT, StatusT } from "@/lib/types";
import { priorityMeta, isLate, withAlpha, dueMeta, statusIcon, textOn } from "@/lib/ui";

export function TaskCard({
  task,
  onOpen,
  onPointerDown,
  showList,
  dragging,
  statuses,
  onSetStatus,
}: {
  task: TaskT;
  onOpen: (id: string) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  showList?: string;
  dragging?: boolean;
  statuses?: StatusT[];
  onSetStatus?: (statusId: string) => void;
}) {
  const prio = priorityMeta(task.priority);
  const bar = task.status?.color || "var(--roxo)";
  const late = isLate(task.dueDate, task.dateClosed);
  const due = dueMeta(task.dueDate, task.dateClosed);

  const pillRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const canPick = !!(statuses && statuses.length && onSetStatus);

  function openStatusMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canPick) return;
    if (pillRef.current) {
      const r = pillRef.current.getBoundingClientRect();
      setMenu({ top: Math.min(r.bottom + 4, window.innerHeight - 220), left: r.left });
    }
  }

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
          <button
            ref={pillRef}
            type="button"
            className="fx-pill"
            onPointerDown={canPick ? (e) => e.stopPropagation() : undefined}
            onClick={openStatusMenu}
            title={canPick ? "Trocar status" : undefined}
            style={{ color: task.status.color, background: withAlpha(task.status.color, 0.13), border: "none", cursor: canPick ? "pointer" : "inherit", font: "inherit" }}
          >
            {task.status.name}
          </button>
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
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 9 }}>
          {task._count && task._count.subtasks > 0 && (() => {
            const total = task._count.subtasks;
            const done = task._count.subtasksDone ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const full = done >= total && total > 0;
            return (
              <span className="fx-meta" title={`${done} de ${total} subtarefas concluídas`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6v12" /><path d="M4 12h3" />
                </svg>
                <span>{done}/{total}</span>
                <span style={{ width: 26, height: 5, borderRadius: 999, background: "var(--line)", overflow: "hidden", display: "inline-block" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct}%`, background: full ? "var(--sage)" : "var(--roxo)" }} />
                </span>
              </span>
            );
          })()}
          {task._count && task._count.comments > 0 && (
            <span className="fx-meta" title={`${task._count.comments} comentário(s)`}>💬 {task._count.comments}</span>
          )}
        </span>
        {due && (
          <span className="fx-meta" style={{ color: due.color, fontWeight: late ? 600 : 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
            📅 {due.label}
          </span>
        )}
      </div>

      {menu && canPick && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setMenu(null); }} onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 2000 }} />
          <div className="fx-popover" style={{ position: "fixed", top: menu.top, left: menu.left, width: 200, zIndex: 2001, padding: 5, maxHeight: 260, overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            {statuses!.map((s) => (
              <button
                key={s.id}
                className="fx-menuitem"
                style={{ width: "100%", borderRadius: 7, display: "flex", alignItems: "center", gap: 8 }}
                onClick={(e) => { e.stopPropagation(); setMenu(null); if (s.id !== (task.statusId || "none")) onSetStatus!(s.id); }}
              >
                <span className="fx-statuspill" style={{ background: s.color, color: textOn(s.color), fontSize: 11, padding: "2px 8px" }}>
                  <span style={{ fontSize: 10, lineHeight: 1 }}>{statusIcon(s.type)}</span>
                  {s.name}
                </span>
                {(task.statusId || "none") === s.id && <span style={{ marginLeft: "auto", color: "var(--roxo)" }}>✓</span>}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
