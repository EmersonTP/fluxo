"use client";

import { useEffect, useRef, useState } from "react";
import type { Member, TaskT, StatusT, TagT, SubtaskT, AttachmentT } from "@/lib/types";
import { toDateInput } from "@/lib/ui";

const TAG_COLORS = ["#9250ac", "#ff7e59", "#7fa08a", "#534ab7", "#d85a30", "#3b82f6"];

const PRIO_OPTS = [
  { value: "", label: "Sem prioridade", color: "#c7c7c7" },
  { value: "urgent", label: "Urgente", color: "#e5484d" },
  { value: "high", label: "Alta", color: "#ff7e59" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "low", label: "Baixa", color: "#9aa0a6" },
];

// Dropdown custom (mesmo visual da lista) pro modal
function FieldPicker({
  label,
  dot,
  open,
  setOpen,
  children,
}: {
  label: React.ReactNode;
  dot?: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="fx-select"
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start" }}
      >
        {dot !== undefined && <span style={{ width: 12, height: 12, borderRadius: "50%", background: dot, flexShrink: 0, border: "1px solid rgba(0,0,0,.12)" }} />}
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ opacity: 0.5, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div className="fx-popover" style={{ top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 61, maxHeight: 240, overflowY: "auto" }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function StatusField({ statuses, value, onChange }: { statuses: StatusT[]; value?: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = statuses.find((s) => s.id === value);
  return (
    <FieldPicker label={cur?.name || "—"} dot={cur?.color || "#a3a3a3"} open={open} setOpen={setOpen}>
      {statuses.map((s) => (
        <button key={s.id} type="button" onClick={() => { onChange(s.id); setOpen(false); }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, flexShrink: 0, border: "1px solid rgba(0,0,0,.12)" }} />
          {s.name}
        </button>
      ))}
    </FieldPicker>
  );
}

function PriorityField({ value, onChange }: { value?: string | null; onChange: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = PRIO_OPTS.find((p) => p.value === (value || ""));
  return (
    <FieldPicker label={cur?.label || "Sem prioridade"} dot={cur?.color} open={open} setOpen={setOpen}>
      {PRIO_OPTS.map((p) => (
        <button key={p.value} type="button" onClick={() => { onChange(p.value); setOpen(false); }}>
          <span style={{ color: p.color }}>⚑</span>
          {p.label}
        </button>
      ))}
    </FieldPicker>
  );
}

type DepLite = { id: string; name: string; status?: { name: string; color: string; type: string } | null };

type FullTask = TaskT & {
  list: { id: string; name: string; statuses: StatusT[] };
  subtasks: SubtaskT[];
  attachments: AttachmentT[];
  comments: { id: string; text: string; createdAt: string; user?: Member | null }[];
  customFields?: Record<string, any> | null;
  blockedBy?: DepLite[];
  blocking?: DepLite[];
  activities?: { id: string; type: string; text: string; createdAt: string; user?: Member | null }[];
  points?: number | null;
  sprint?: { id: string; name: string } | null;
};

// Render leve e seguro de comentário: escapa HTML, preserva quebras (pre-wrap no container),
// aplica **negrito**, *itálico* e realça @menções.
function renderRich(text: string): string {
  let h = (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  h = h.replace(/(^|\s)@([\p{L}][\p{L}\d_.-]{1,30})/gu, "$1<span style=\"color:var(--roxo);font-weight:600\">@$2</span>");
  return h;
}

export default function TaskModal({
  taskId,
  members,
  onClose,
  onUpdated,
  onDeleted,
  onOpenTask,
}: {
  taskId: string;
  members: Member[];
  onClose: () => void;
  onUpdated: (t: TaskT) => void;
  onDeleted: (id: string) => void;
  onOpenTask?: (id: string) => void;
}) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = descRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 480) + "px"; } }, [description]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagT[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [showAssign, setShowAssign] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [subTab, setSubTab] = useState("Diária");
  const [novaCad, setNovaCad] = useState("Diária");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [depPickerOpen, setDepPickerOpen] = useState(false);
  const [depSearch, setDepSearch] = useState("");
  const [listTasks, setListTasks] = useState<DepLite[]>([]);
  const [newCfKey, setNewCfKey] = useState("");
  const [newCfTipo, setNewCfTipo] = useState("texto");
  const [newCfOpcoes, setNewCfOpcoes] = useState("");
  const [sprints, setSprints] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/sprints").then((r) => r.json()).then((d) => setSprints((d.sprints || []).map((s: any) => ({ id: s.id, name: s.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.task) {
          alert(d.error || "Tarefa indisponível.");
          onClose();
          return;
        }
        setTask(d.task);
        setName(d.task.name);
        setDescription(d.task.description || "");
        if (d.task.list?.id) {
          fetch(`/api/tags?listId=${d.task.list.id}`)
            .then((r) => r.json())
            .then((td) => setAvailableTags(td.tags || []));
        }
      })
      .catch(() => {
        alert("Falha ao carregar a tarefa.");
        onClose();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Atualiza o histórico ao vivo (a resposta do PATCH não traz as atividades)
      fetch(`/api/tasks/${taskId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.task?.activities) setTask((prev) => (prev ? { ...prev, activities: d.task.activities } : prev));
        })
        .catch(() => {});
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

  async function reload() {
    const d = await fetch(`/api/tasks/${taskId}`).then((r) => r.json());
    if (d.task) setTask(d.task);
  }

  async function openDepPicker() {
    setDepPickerOpen((s) => !s);
    if (!depPickerOpen && task) {
      const d = await fetch(`/api/lists/${task.list.id}`).then((r) => r.json());
      setListTasks((d.list?.tasks || []).map((t: any) => ({ id: t.id, name: t.name, status: t.status })));
    }
  }

  async function addDependency(id: string) {
    await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addDependsOn: id }) });
    setDepSearch("");
    setDepPickerOpen(false);
    await reload();
  }
  async function removeDependency(id: string) {
    await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeDependsOn: id }) });
    await reload();
  }

  // Campo estruturado: { tipo: texto|numero|data|escolha, valor, opcoes? }. Leitura retrocompatível (string antiga vira texto).
  function normCf(v: any): { tipo: string; valor: string; opcoes?: string[] } {
    if (v && typeof v === "object") return { tipo: v.tipo || "texto", valor: v.valor ?? "", opcoes: Array.isArray(v.opcoes) ? v.opcoes : undefined };
    return { tipo: "texto", valor: v == null ? "" : String(v) };
  }
  function saveCustomFields(next: Record<string, any>) {
    setTask((prev) => (prev ? { ...prev, customFields: next } : prev));
    patch({ customFields: next });
  }
  function setCfValue(key: string, value: string) {
    const cur = normCf((task?.customFields || {})[key]);
    const next = { ...(task?.customFields || {}), [key]: { ...cur, valor: value } };
    setTask((prev) => (prev ? { ...prev, customFields: next } : prev));
  }
  function commitCf() {
    saveCustomFields({ ...(task?.customFields || {}) });
  }
  function removeCf(key: string) {
    const next = { ...(task?.customFields || {}) };
    delete next[key];
    saveCustomFields(next);
  }
  function addCf() {
    const k = newCfKey.trim();
    if (!k) return;
    const opcoes = newCfTipo === "escolha" ? newCfOpcoes.split(",").map((o) => o.trim()).filter(Boolean) : undefined;
    saveCustomFields({ ...(task?.customFields || {}), [k]: { tipo: newCfTipo, valor: "", ...(opcoes ? { opcoes } : {}) } });
    setNewCfKey("");
    setNewCfTipo("texto");
    setNewCfOpcoes("");
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

  async function createTag(nameArg?: string) {
    const tagName = (nameArg ?? newTagName).trim();
    if (!task || !tagName) return;
    const color = TAG_COLORS[availableTags.length % TAG_COLORS.length];
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tagName, color, listId: task.list.id }),
    });
    const data = await res.json();
    if (data.tag) {
      setAvailableTags((prev) => (prev.some((t) => t.id === data.tag.id) ? prev : [...prev, data.tag]));
      setNewTagName("");
      setTagSearch("");
      patch({ tagIds: [...task.tags.map((t) => t.id), data.tag.id] });
    }
  }

  const TAG_CAD: Record<string, string> = { "Diária": "[DIÁRIA] ", "Semanal": "[SEMANAL] ", "Mensal": "[MENSAL] ", "Uma vez": "[UMA VEZ] ", "Sem cadência": "" };
  async function addSubtask() {
    if (!task || !newSubtask.trim()) return;
    const jaTemTag = /^\s*\[[^\]]*\]/.test(newSubtask);
    const nome = jaTemTag ? newSubtask : (TAG_CAD[novaCad] || "") + newSubtask;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: task.list.id, name: nome, parentId: task.id }),
    });
    const data = await res.json();
    if (data.task) {
      const st: SubtaskT = { id: data.task.id, name: data.task.name, statusId: data.task.statusId, status: data.task.status, assignees: data.task.assignees || [] };
      setTask((prev) => (prev ? { ...prev, subtasks: [...prev.subtasks, st] } : prev));
      setNewSubtask("");
    }
  }

  async function deleteSubtask(st: SubtaskT) {
    if (!task) return;
    if (!window.confirm(`Excluir a subtarefa "${st.name}"?`)) return;
    setTask((prev) => (prev ? { ...prev, subtasks: prev.subtasks.filter((s) => s.id !== st.id) } : prev));
    await fetch(`/api/tasks/${st.id}`, { method: "DELETE" });
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
              onBlur={() => name.trim() && name !== task.name && patch({ name: name.trim() })}
              onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
              title="Clique para editar o título"
              placeholder="Título da tarefa"
              className="serif fx-title-edit"
              style={{ fontSize: 24, fontWeight: 500, width: "100%", border: "1px solid transparent", borderRadius: 8, background: "transparent", color: "var(--txt)", outline: "none", padding: "2px 8px", marginLeft: -8, paddingRight: 30 }}
            />
            <div style={{ fontSize: 12, color: "var(--txt-faint)", marginBottom: 8 }}>{task.list.name}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div className="fx-field-label">Status</div>
                <StatusField statuses={task.list.statuses} value={task.statusId} onChange={(id) => patch({ statusId: id })} />
              </div>
              <div>
                <div className="fx-field-label">Prioridade</div>
                <PriorityField value={task.priority} onChange={(p) => patch({ priority: p })} />
              </div>
              <div>
                <div className="fx-field-label">Prazo</div>
                <input className="fx-input" type="date" value={toDateInput(task.dueDate)} onChange={(e) => patch({ dueDate: e.target.value || null })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <div className="fx-field-label">Sprint</div>
                <select className="fx-select" value={task.sprint?.id || ""} onChange={(e) => patch({ sprintId: e.target.value || null })}>
                  <option value="">— sem sprint —</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="fx-field-label">Pontos (estimativa)</div>
                <input
                  className="fx-input"
                  type="number"
                  min={0}
                  placeholder="—"
                  value={task.points ?? ""}
                  onChange={(e) => setTask((prev) => (prev ? { ...prev, points: e.target.value === "" ? null : Number(e.target.value) } : prev))}
                  onBlur={(e) => patch({ points: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="fx-field-label">Responsáveis</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {task.assignees.map((a) => (
                <button key={a.id} className="fx-chip on" onClick={() => toggleAssignee(a.id)} title="Remover">
                  <span className="fx-avatar" style={{ width: 18, height: 18, fontSize: 8, background: a.color }}>
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  {a.name.split(" ")[0]}
                  <span style={{ opacity: 0.5 }}>✕</span>
                </button>
              ))}
              <button className="fx-chip" style={{ borderStyle: "dashed" }} onClick={() => setShowAssign((s) => !s)}>
                + Responsável
              </button>
            </div>
            {showAssign && (
              <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, padding: 8, maxHeight: 220, overflowY: "auto" }}>
                <input className="fx-input" placeholder="Buscar pessoa..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} style={{ marginBottom: 8 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {members
                    .filter((m) => m.name.toLowerCase().includes(assignSearch.toLowerCase()))
                    .map((m) => {
                      const active = task.assignees.some((a) => a.id === m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleAssignee(m.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, border: "none", background: active ? "rgba(146,80,172,.1)" : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--txt)", textAlign: "left", width: "100%" }}
                        >
                          <span className="fx-avatar" style={{ width: 20, height: 20, fontSize: 9, background: m.color }}>
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                          {active && <span style={{ color: "var(--roxo)" }}>✓</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="fx-field-label">Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {task.tags.map((t) => (
                <button key={t.id} className="fx-pill" onClick={() => toggleTag(t.id)} title="Remover" style={{ color: t.color, background: t.color + "22", border: `1px solid ${t.color}`, cursor: "pointer" }}>
                  {t.name} <span style={{ opacity: 0.6 }}>✕</span>
                </button>
              ))}
              <button className="fx-chip" style={{ borderStyle: "dashed" }} onClick={() => setShowTagEditor((s) => !s)}>
                + Tag
              </button>
            </div>
            {showTagEditor && (
              <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, padding: 8, maxHeight: 240, overflowY: "auto" }}>
                <input
                  className="fx-input"
                  placeholder="Buscar ou criar tag... (Enter cria)"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagSearch.trim() && !availableTags.find((t) => t.name.toLowerCase() === tagSearch.toLowerCase())) {
                      createTag(tagSearch);
                    }
                  }}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {availableTags
                    .filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                    .map((t) => {
                      const active = task.tags.some((x) => x.id === t.id);
                      return (
                        <button key={t.id} onClick={() => toggleTag(t.id)} className="fx-pill" style={{ color: t.color, background: active ? t.color + "22" : "transparent", border: `1px solid ${t.color}`, cursor: "pointer", opacity: active ? 1 : 0.6 }}>
                          {active ? "✓ " : ""}{t.name}
                        </button>
                      );
                    })}
                  {tagSearch.trim() && !availableTags.find((t) => t.name.toLowerCase() === tagSearch.toLowerCase()) && (
                    <button className="fx-chip" style={{ borderStyle: "dashed", color: "var(--roxo)" }} onClick={() => createTag(tagSearch)}>
                      + criar “{tagSearch}”
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="fx-field-label">
              Subtarefas ({task.subtasks.filter((s) => s.status?.type === "done" || s.status?.type === "closed").length}/{task.subtasks.length})
            </div>
            <div>
              {(() => {
                const isDone = (st: SubtaskT) => st.status?.type === "done" || st.status?.type === "closed";
                const grupoDe = (name: string) => { const m = /^\[\s*([^\]]+?)\s*\]/.exec(name || ""); const t = (m ? m[1] : "").toUpperCase(); if (t.startsWith("DI")) return "Diária"; if (t.startsWith("SEMANAL")) return "Semanal"; if (t.startsWith("MENSAL") || t.startsWith("MES")) return "Mensal"; if (t.startsWith("UMA")) return "Uma vez"; return "Outras"; };
                const semTag = (name: string) => name.replace(/^\[[^\]]*\]\s*/, "");
                const ordem = ["Diária", "Semanal", "Mensal", "Uma vez", "Outras"];
                const grupos: Record<string, SubtaskT[]> = {};
                for (const st of task.subtasks) { const g = grupoDe(st.name); (grupos[g] = grupos[g] || []).push(st); }
                const chaves = Object.keys(grupos).sort((a, b) => (ordem.indexOf(a) < 0 ? 9 : ordem.indexOf(a)) - (ordem.indexOf(b) < 0 ? 9 : ordem.indexOf(b)));
                const corG: Record<string, string> = { "Diária": "#274b6d", "Semanal": "#7a4fb0", "Mensal": "#b5651d", "Uma vez": "#0f6b50", "Outras": "#9a8f84" };
                const row = (st: SubtaskT) => {
                  const done = isDone(st);
                  return (
                    <div key={st.id} className={`fx-subtask ${done ? "done" : ""}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={done} onChange={() => toggleSubtask(st)} />
                      <span style={{ flex: 1, minWidth: 0, cursor: onOpenTask ? "pointer" : "default" }} onClick={onOpenTask ? () => onOpenTask(st.id) : undefined} title={onOpenTask ? "Abrir subtarefa (criar sub-subtarefas, prazo, responsável, descrição…)" : undefined}>{semTag(st.name)}</span>
                      <button type="button" aria-label="Excluir subtarefa" title="Excluir subtarefa" onClick={() => deleteSubtask(st)} style={{ background: "none", border: "none", color: "var(--txt-faint)", cursor: "pointer", padding: "2px 4px", lineHeight: 1, fontSize: 13 }}>✕</button>
                    </div>
                  );
                };
                if (chaves.length === 0) return null;
                // aba ativa: respeita a escolha; se a escolhida nao existe, cai na 1a (default Diária)
                const ativa = subTab === "Todas" ? "Todas" : (chaves.includes(subTab) ? subTab : chaves[0]);
                const abas = [...chaves, "Todas"];
                return (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 10px" }}>
                      {abas.map((g) => {
                        const on = g === ativa;
                        const cor = g === "Todas" ? "var(--txt-faint)" : corG[g];
                        const cnt = g === "Todas" ? task.subtasks.length : grupos[g].length;
                        return (
                          <button key={g} type="button" onClick={() => { setSubTab(g); if (g !== "Todas") setNovaCad(g); }}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: on ? 700 : 500, border: on ? `1px solid ${cor}` : "1px solid var(--line)", background: on ? cor : "transparent", color: on ? "#fff" : "var(--txt)" }}>
                            {g !== "Todas" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#fff" : corG[g] }} />}
                            {g} <span style={{ opacity: on ? 0.85 : 0.5, fontWeight: 400 }}>{cnt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {ativa === "Todas"
                      ? chaves.map((g) => (
                          <div key={g} style={{ marginBottom: 4 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: corG[g], margin: "10px 0 3px", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: corG[g] }} />{g} <span style={{ color: "var(--txt-faint)", fontWeight: 400 }}>({grupos[g].filter(isDone).length}/{grupos[g].length})</span>
                            </div>
                            {grupos[g].map(row)}
                          </div>
                        ))
                      : grupos[ativa].map(row)}
                  </>
                );
              })()}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <select className="fx-input" value={novaCad} onChange={(e) => setNovaCad(e.target.value)} title="Cadência da subtarefa" style={{ flex: "0 0 130px", width: 130 }}>
                  <option value="Diária">Diária</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Uma vez">Uma vez</option>
                  <option value="Sem cadência">Sem cadência</option>
                </select>
                <input className="fx-input" style={{ flex: 1 }} value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="+ Adicionar subtarefa" />
              </div>
            </div>

            <div className="fx-field-label">Dependências</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(task.blockedBy || []).map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ fontSize: 11, color: "var(--coral-deep)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em", whiteSpace: "nowrap" }}>Espera por</span>
                  <span className="fx-dot" style={{ background: d.status?.color || "#a3a3a3" }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <button onClick={() => removeDependency(d.id)} style={{ background: "none", border: "none", color: "var(--txt-faint)", cursor: "pointer" }}>✕</button>
                </div>
              ))}
              {(task.blocking || []).map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.85 }}>
                  <span style={{ fontSize: 11, color: "var(--roxo)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em", whiteSpace: "nowrap" }}>Trava</span>
                  <span className="fx-dot" style={{ background: d.status?.color || "#a3a3a3" }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                </div>
              ))}
            </div>
            <button className="fx-chip" style={{ borderStyle: "dashed", marginTop: 6 }} onClick={openDepPicker}>
              + Adicionar dependência
            </button>
            {depPickerOpen && (
              <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, padding: 8, maxHeight: 240, overflowY: "auto" }}>
                <input className="fx-input" placeholder="Buscar tarefa que trava esta..." value={depSearch} onChange={(e) => setDepSearch(e.target.value)} style={{ marginBottom: 8 }} autoFocus />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {listTasks
                    .filter((t) => t.id !== task.id && t.name.toLowerCase().includes(depSearch.toLowerCase()) && !(task.blockedBy || []).some((b) => b.id === t.id))
                    .slice(0, 30)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addDependency(t.id)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--txt)", textAlign: "left", width: "100%" }}
                      >
                        <span className="fx-dot" style={{ background: t.status?.color || "#a3a3a3" }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="fx-field-label">Campos personalizados</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(task.customFields || {}).map(([key, raw]) => {
                const cf = normCf(raw);
                const tipoLabel = cf.tipo === "numero" ? "nº" : cf.tipo === "data" ? "data" : cf.tipo === "escolha" ? "opção" : "texto";
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 130, fontSize: 12.5, color: "var(--txt-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }} title={`${key} (${tipoLabel})`}>{key}</span>
                    {cf.tipo === "escolha" ? (
                      <select className="fx-input" style={{ flex: 1 }} value={cf.valor} onChange={(e) => { setCfValue(key, e.target.value); }} onBlur={commitCf}>
                        <option value="">—</option>
                        {(cf.opcoes || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="fx-input"
                        style={{ flex: 1 }}
                        type={cf.tipo === "numero" ? "number" : cf.tipo === "data" ? "date" : "text"}
                        value={cf.valor}
                        onChange={(e) => setCfValue(key, e.target.value)}
                        onBlur={commitCf}
                      />
                    )}
                    <button onClick={() => removeCf(key)} style={{ background: "none", border: "none", color: "var(--txt-faint)", cursor: "pointer" }} title="Remover campo">✕</button>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input className="fx-input" style={{ width: 130, flexShrink: 0 }} placeholder="Campo" value={newCfKey} onChange={(e) => setNewCfKey(e.target.value)} />
                <select className="fx-input" style={{ width: 110, flexShrink: 0 }} value={newCfTipo} onChange={(e) => setNewCfTipo(e.target.value)}>
                  <option value="texto">Texto</option>
                  <option value="numero">Número</option>
                  <option value="data">Data</option>
                  <option value="escolha">Escolha</option>
                </select>
                {newCfTipo === "escolha" && (
                  <input className="fx-input" style={{ flex: 1, minWidth: 140 }} placeholder="Opções separadas por vírgula" value={newCfOpcoes} onChange={(e) => setNewCfOpcoes(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCf()} />
                )}
                <button className="fx-chip" style={{ borderStyle: "dashed" }} onClick={addCf}>+ Add</button>
              </div>
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
              ref={descRef}
              className="fx-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description || "") && patch({ description })}
              placeholder="Adicione uma descrição..."
              style={{ resize: "vertical", minHeight: 240, maxHeight: 480, overflowY: "auto", lineHeight: 1.5 }}
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
                    <div className="bubble" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: renderRich(c.text) }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <textarea className="fx-input" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }} placeholder="Escreva um comentário…  (Enter envia, Shift+Enter quebra · @ menciona)" rows={2} style={{ resize: "vertical", minHeight: 44 }} />
              <button className="fx-btn fx-btn-primary" onClick={addComment}>
                Enviar
              </button>
            </div>

            {task.activities && task.activities.length > 0 && (
              <>
                <div className="fx-field-label">Histórico</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {task.activities.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--txt-soft)" }}>
                      <span className="fx-avatar" style={{ width: 20, height: 20, fontSize: 9, background: a.user?.color || "var(--txt-faint)", flexShrink: 0 }}>
                        {(a.user?.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ color: "var(--txt)", fontWeight: 600 }}>{a.user?.name || "Alguém"}</b> {a.text}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--txt-faint)", whiteSpace: "nowrap" }}>
                        {new Date(a.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

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
