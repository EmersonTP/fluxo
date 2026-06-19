"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Stats = { total: number; done: number; pts: number; donePts: number };
type Sprint = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  companyId: string;
  company?: { name: string } | null;
  stats?: Stats;
};
type Company = { id: string; name: string };

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
}

export default function SprintsPanel() {
  const router = useRouter();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", goal: "", companyId: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/sprints").then((r) => r.json()).then((d) => setSprints(d.sprints || [])).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    fetch("/api/admin/companies").then((r) => (r.ok ? r.json() : { companies: [] })).then((d) => setCompanies(d.companies || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    fetch(`/api/sprints/${openId}`).then((r) => r.json()).then((d) => setDetail(d.sprint));
  }, [openId]);

  async function create() {
    if (!form.name.trim()) return;
    const res = await fetch("/api/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (res.ok) {
      setForm({ name: "", startDate: "", endDate: "", goal: "", companyId: "" });
      setCreating(false);
      load();
    } else alert(d.error || "Erro ao criar sprint.");
  }

  async function renameSprint(id: string) {
    const name = editVal.trim();
    setEditingId(null);
    if (!name) return;
    setSprints((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    await fetch(`/api/sprints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function removeSprint(s: Sprint) {
    if (!confirm(`Excluir o sprint "${s.name}"? As tarefas continuam, só saem do sprint.`)) return;
    await fetch(`/api/sprints/${s.id}`, { method: "DELETE" });
    if (openId === s.id) setOpenId(null);
    load();
  }

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Planejamento</div>
          <div className="fx-title">Sprints</div>
        </div>
        <button className="fx-addbtn-top" style={{ marginLeft: "auto" }} onClick={() => setCreating((s) => !s)}>+ Novo sprint</button>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 48px", maxWidth: 820 }}>
        {creating && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 18, marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="fx-input" placeholder="Nome do sprint (ex.: Sprint 12 — 04 a 10/05)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "var(--txt-soft)" }}>Início<br /><input className="fx-input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
              <label style={{ fontSize: 12, color: "var(--txt-soft)" }}>Fim<br /><input className="fx-input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
              {companies.length > 0 && (
                <label style={{ fontSize: 12, color: "var(--txt-soft)" }}>Empresa<br />
                  <select className="fx-select" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                    <option value="">Selecione…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <input className="fx-input" placeholder="Meta do sprint (opcional)" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fx-btn fx-btn-primary" onClick={create}>Criar sprint</button>
              <button className="fx-btn" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {loading && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {!loading && sprints.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum sprint ainda. Crie o primeiro no “+ Novo sprint”.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sprints.map((s) => {
            const st = s.stats || { total: 0, done: 0, pts: 0, donePts: 0 };
            const pct = st.pts > 0 ? Math.round((st.donePts / st.pts) * 100) : st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
            const open = openId === s.id;
            return (
              <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", cursor: "pointer" }} onClick={() => setOpenId(open ? null : s.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {editingId === s.id ? (
                      <input
                        autoFocus
                        className="fx-input"
                        style={{ flex: 1, fontSize: 16 }}
                        value={editVal}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => renameSprint(s.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameSprint(s.id); if (e.key === "Escape") setEditingId(null); }}
                      />
                    ) : (
                      <span
                        className="serif"
                        style={{ fontSize: 17, fontWeight: 500, flex: 1 }}
                        title="Duplo-clique para renomear"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(s.id); setEditVal(s.name); }}
                      >{s.name}</span>
                    )}
                    {companies.length > 0 && s.company && <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{s.company.name}</span>}
                    <span style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>{fmt(s.startDate)} – {fmt(s.endDate)}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeSprint(s); }} style={{ background: "none", border: "none", color: "var(--txt-faint)", cursor: "pointer", fontSize: 12 }}>excluir</button>
                  </div>
                  {s.goal && <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 4 }}>🎯 {s.goal}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                    <div style={{ flex: 1, height: 10, background: "var(--col)", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--sage)" }} />
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--txt)" }}>{pct}%</span>
                    <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{st.done}/{st.total} tarefas · {st.donePts}/{st.pts} pts</span>
                  </div>
                </div>
                {open && (
                  <div style={{ borderTop: "1px solid var(--line)" }}>
                    {!detail && <p style={{ padding: 16, color: "var(--txt-faint)", fontSize: 13 }}>Carregando tarefas…</p>}
                    {detail && detail.tasks?.length === 0 && <p style={{ padding: 16, color: "var(--txt-faint)", fontSize: 13 }}>Nenhuma tarefa neste sprint. Adicione pelo modal de uma tarefa (campo “Sprint”).</p>}
                    {detail && detail.tasks?.map((t: any) => {
                      const done = !!t.dateClosed || t.status?.type === "done" || t.status?.type === "closed";
                      return (
                        <div key={t.id} onClick={() => router.push(`/list/${t.list.id}?task=${t.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", borderTop: "1px solid var(--line)", cursor: "pointer", fontSize: 13.5 }}>
                          <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.status?.color || "#a3a3a3", flexShrink: 0 }} />
                          <span style={{ flex: 1, textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                          {t.points != null && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--roxo)", background: "rgba(146,80,172,.12)", borderRadius: 999, padding: "2px 8px" }}>{t.points} pts</span>}
                          <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{t.list?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
