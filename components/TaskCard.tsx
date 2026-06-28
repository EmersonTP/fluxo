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
  onChanged,
}: {
  task: TaskT;
  onOpen: (id: string) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  showList?: string;
  dragging?: boolean;
  statuses?: StatusT[];
  onSetStatus?: (statusId: string) => void;
  onChanged?: () => void;
}) {
  const prio = priorityMeta(task.priority);
  const bar = task.status?.color || "var(--roxo)";
  const late = isLate(task.dueDate, task.dateClosed);
  const due = dueMeta(task.dueDate, task.dateClosed);

  const pillRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const canPick = !!(statuses && statuses.length && onSetStatus);

  // Menu de ações do cartão (⋯): duplicar / excluir
  const kebabRef = useRef<HTMLButtonElement>(null);
  const [actMenu, setActMenu] = useState<{ top: number; left: number } | null>(null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const canAct = !!onChanged;

  function openStatusMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canPick) return;
    if (pillRef.current) {
      const r = pillRef.current.getBoundingClientRect();
      setMenu({ top: Math.min(r.bottom + 4, window.innerHeight - 220), left: r.left });
    }
  }

  function openActMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (kebabRef.current) {
      const r = kebabRef.current.getBoundingClientRect();
      setActMenu({ top: Math.min(r.bottom + 4, window.innerHeight - 120), left: Math.max(8, r.right - 168) });
    }
  }

  async function duplicar(e: React.MouseEvent) {
    e.stopPropagation();
    setActMenu(null);
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${task.id}/duplicate`, { method: "POST" });
      if (r.ok) onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function excluir(e: React.MouseEvent) {
    e.stopPropagation();
    setActMenu(null);
    if (busy) return;
    if (!window.confirm(`Excluir a tarefa "${task.name}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (r.ok) onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fx-card"
      onPointerDown={onPointerDown}
      onClick={onPointerDown ? undefined : () => onOpen(task.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ["--bar" as any]: bar,
        position: "relative",
        userSelect: "none",
        touchAction: "none",
        cursor: onPointerDown ? "grab" : "pointer",
        ...(dragging ? { opacity: 0.4, borderStyle: "dashed", borderColor: "var(--roxo)" } : {}),
      }}
    >
      {canAct && (
        <button
          ref={kebabRef}
          type="button"
          aria-label="Ações da tarefa"
          title="Ações"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={openActMenu}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: 7,
            border: "none",
            background: actMenu ? "var(--line)" : "transparent",
            color: "var(--txt-soft)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: hover || actMenu ? 1 : 0.35,
            transition: "opacity .12s, background .12s",
            zIndex: 3,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </button>
      )}

      <div className="fx-card-title" style={canAct ? { paddingRight: 20 } : undefined}>{task.name}</div>
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

      {actMenu && canAct && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setActMenu(null); }} onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 2000 }} />
          <div className="fx-popover" style={{ position: "fixed", top: actMenu.top, left: actMenu.left, width: 168, zIndex: 2001, padding: 5 }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <button className="fx-menuitem" style={{ width: "100%", borderRadius: 7, display: "flex", alignItems: "center", gap: 9 }} onClick={duplicar}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Duplicar
            </button>
            <button className="fx-menuitem" style={{ width: "100%", borderRadius: 7, display: "flex", alignItems: "center", gap: 9, color: "#a8332c" }} onClick={excluir}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Excluir
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
