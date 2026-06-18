"use client";

import { useEffect, useRef, useState } from "react";
import type { Member, TaskT, StatusT, TagT, SubtaskT, AttachmentT } from "@/lib/types";
import { PRIORITIES, toDateInput } from "@/lib/ui";

const TAG_COLORS = ["#9250ac", "#ff7e59", "#7fa08a", "#534ab7", "#d85a30", "#3b82f6"];

type FullTask = TaskT & {
  list: { id: string; name: string; statuses: StatusT[] };
  subtasks: SubtaskT[];
  attachments: AttachmentT[];
  comments: { id: string; text: string; createdAt: string; user?: Member | null }[];
};

export default function TaskModal({
  taskId,
  members,
  onClose,
  onUpdated,
  onDeleted,
}: {
  taskId: string;
  members: Member[];
  onClose: () => void;
  onUpdated: (t: TaskT) => void;
  onDeleted: (id: string) => void;
}) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagT[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((d) => {
        setTask(d.task);
        setName(d.task.name);
        setDescription(d.task.description || "");
        if (d.task.list?.id) {
          fetch(`/api/tags?listId=${d.task.list.id}`)
            .then((r) => r.json())
            .then((td) => setAvailableTags(td.tags || []));
        }
      });
  }, [taskId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (data.task) {
      onUpdated(data.task);
      setTask((prev) => (prev ? { ...prev, ...data.task } : prev));
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, text: comment }),
    });
    const data = await res.json();
    if (data.comment) {
      setTask((prev) => (prev ? { ...prev, comments: [...prev.comments, data.comment] } : prev));
      setComment("");
    }
  }

  async function remove() {
    if (!confirm("Excluir esta tarefa?")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    onDeleted(taskId);
  }

  function toggleAssignee(id: string) {
    if (!task) return;
    const has = task.assignees.some((a) => a.id === id);
    const ids = has ? task.assignees.filter((a) => a.id !== id).map((a) => a.id) : [...task.assignees.map((a) => a.id), id];
    patch({ assigneeIds: ids });
  }

  function toggleTag(tagId: string) {
    if (!task) return;
    const has = task.tags.some((t) => t.id === tagId);
    const ids = has ? task.tags.filter((t) => t.id !== tagId).map((t) => t.id) : [...task.tags.map((t) => t.id), tagId];
    patch({ tagIds: ids });
  }

  async function createTag() {
    if (!task || !newTagName.trim()) return;
    const color = TAG_COLORS[availableTags.length % TAG_COLORS.length];
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName, color, listId: task.list.id }),
    });
    const data = await res.json();
    if (data.tag) {
      setAvailableTags((prev) => (prev.some((t) => t.id === data.tag.id) ? prev : [...prev, data.tag]));
      setNewTagName("");
      patch({ tagIds: [...task.tags.map((t) => t.id), data.tag.id] });
    }
  }

  async function addSubtask() {
    if (!task || !newSubtask.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: task.list.id, name: newSubtask, parentId: task.id }),
    });
    const data = await res.json();
    if (data.task) {
      const st: SubtaskT = { id: data.task.id, name: data.task.name, statusId: data.task.statusId, status: data.task.status, assignees: data.task.assignees || [] };
      setTask((prev) => (prev ? { ...prev, subtasks: [...prev.subtasks, st] } : prev));
      setNewSubtask("");
    }
  }

  async function toggleSubtask(st: SubtaskT) {
    if (!task) return;
    const doneStatus = task.list.statuses.find((s) => s.type === "done" || s.type === "closed");
    const firstStatus = task.list.statuses[0];
    const isDone = st.status?.type === "done" || st.status?.type === "closed";
    const target = isDone ? firstStatus : doneStatus || firstStatus;
    if (!target) return;
    setTask((prev) =>
      prev ? { ...prev, subtasks: prev.subtasks.map((s) => (s.id === st.id ? { ...s, statusId: target.id, status: target } : s)) } : prev
    );
    await fetch(`/api/tasks/${st.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: target.id }),
    });
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (data.attachment) setTask((prev) => (prev ? { ...prev, attachments: [data.attachment, ...prev.attachments] } : prev));
    else if (data.error) alert(data.error);
  }

  async function deleteAttachment(id: string) {
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    setTask((prev) => (prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== id) } : prev));
  }

  const bar = task?.status?.color || "var(--roxo)";

  return (
    <div className="fx-overlay" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-modal-bar" style={{ background: bar }} />
        <button className="fx-modal-close" onClick={onClose}>
          ✕
        </button>
        {!task ? (
          <div style={{ padding: 40, color: "var(--txt-soft)" }}>Carregando...</div>
        ) : (
          <div style={{ padding: "26px 28px 30px" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== task.name && patch({ name })}
              className="serif"
              style={{ fontSize: 24, fontWeight: 500, width: "100%", border: "none", background: "transparent", color: "var(--txt)", outline: "none", paddingRight: 30 }}
            />
            <div style={{ fontSize: 12, color: "var(--txt-faint)", marginBottom: 8 }}>{task.list.name}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div className="fx-field-label">Status</div>
                <select className="fx-select" value={task.statusId || ""} onChange={(e) => patch({ statusId: e.target.value })}>
                  {task.list.statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="fx-field-label">Prioridade</div>
                <select className="fx-select" value={task.priority || ""} onChange={(e) => patch({ priority: e.target.value })}>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="fx-field-label">Prazo</div>
                <input className="fx-input" type="date" value={toDateInput(task.dueDate)} onChange={(e) => patch({ dueDate: e.target.value || null })} />
              </div>
            </div>

            <div className="fx-field-label">Responsáveis</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {members.map((m) => {
                const active = task.assignees.some((a) => a.id === m.id);
                return (
                  <button key={m.id} className={`fx-chip ${active ? "on" : ""}`} onClick={() => toggleAssignee(m.id)}>
                    <span className="fx-avatar" style={{ width: 18, height: 18, fontSize: 8, background: m.color }}>
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    {m.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>

            <div className="fx-field-label">Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {availableTags.map((t) => {
                const active = task.tags.some((x) => x.id === t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className="fx-pill"
                    style={{ color: t.color, background: active ? t.color + "22" : "transparent", border: `1px solid ${t.color}`, cursor: "pointer", opacity: active ? 1 : 0.55 }}
                  >
                    {t.name}
                  </button>
                );
              })}
              <button className="fx-chip" onClick={() => setShowTagEditor((s) => !s)} style={{ borderStyle: "dashed" }}>
                + nova tag
              </button>
            </div>
            {showTagEditor && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input className="fx-input" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createTag()} placeholder="Nome da tag" />
                <button className="fx-btn fx-btn-primary" onClick={createTag}>
                  Criar
                </button>
              </div>
            )}

            <div className="fx-field-label">
              Subtarefas ({task.subtasks.filter((s) => s.status?.type === "done" || s.status?.type === "closed").length}/{task.subtasks.length})
            </div>
            <div>
              {task.subtasks.map((st) => {
                const done = st.status?.type === "done" || st.status?.type === "closed";
                return (
                  <label key={st.id} className={`fx-subtask ${done ? "done" : ""}`}>
                    <input type="checkbox" checked={done} onChange={() => toggleSubtask(st)} />
                    <span>{st.name}</span>
                  </label>
                );
              })}
              <input className="fx-input" style={{ marginTop: 8 }} value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="+ Adicionar subtarefa" />
            </div>

            <div className="fx-field-label">Anexos ({task.attachments.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {task.attachments.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--col)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                  <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" style={{ flex: 1, color: "var(--roxo)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    📎 {a.filename}
                  </a>
                  <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{(a.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => deleteAttachment(a.id)} style={{ background: "none", border: "none", color: "var(--txt-faint)", cursor: "pointer", fontSize: 12 }}>
                    remover
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" onChange={uploadFile} style={{ display: "none" }} />
            <button className="fx-btn" style={{ marginTop: 8, borderStyle: "dashed" }} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Enviando..." : "+ Anexar arquivo"}
            </button>

            <div className="fx-field-label">Descrição</div>
            <textarea
              className="fx-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description || "") && patch({ description })}
              placeholder="Adicione uma descrição..."
              style={{ resize: "vertical" }}
            />

            <div className="fx-field-label">Comentários ({task.comments.length})</div>
            <div>
              {task.comments.map((c) => (
                <div key={c.id} className="fx-comment">
                  <span className="fx-avatar" style={{ background: c.user?.color || "var(--roxo-deep)" }}>
                    {(c.user?.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="who">
                      {c.user?.name || "Desconhecido"} · <span style={{ color: "var(--txt-faint)", fontWeight: 400 }}>{new Date(c.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="bubble">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="fx-input" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} placeholder="Escreva um comentário..." />
              <button className="fx-btn fx-btn-primary" onClick={addComment}>
                Enviar
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <button onClick={remove} style={{ background: "none", border: "none", color: "var(--coral-deep)", cursor: "pointer", fontSize: 13 }}>
                Excluir tarefa
              </button>
              <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{saving ? "Salvando..." : "Salvo"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
