"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceT, SpaceT, FolderT, ListLite } from "@/lib/types";

const SPACE_COLORS = ["#9250ac", "#ff7e59", "#1d9e75", "#534ab7", "#d85a30", "#3b82f6", "#ec4899", "#f59e0b"];

export default function SpacePanel({ id }: { id: string }) {
  const router = useRouter();
  const [sp, setSp] = useState<SpaceT | null>(null);
  const [wsName, setWsName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[0]);
  const [loading, setLoading] = useState(true);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newList, setNewList] = useState("");

  function load() {
    fetch("/api/hierarchy")
      .then((r) => r.json())
      .then((d) => {
        for (const w of (d.workspaces || []) as WorkspaceT[]) {
          const i = w.spaces.findIndex((s) => s.id === id);
          if (i >= 0) {
            setSp(w.spaces[i]);
            setWsName(w.name);
            setColor(w.spaces[i].color || SPACE_COLORS[i % SPACE_COLORS.length]);
            return;
          }
        }
        setSp(null);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  const looseLists: ListLite[] = sp?.lists || [];
  const folders: FolderT[] = sp?.folders || [];
  const totalLists = looseLists.length + folders.reduce((n, f) => n + f.lists.length, 0);
  const totalTasks =
    looseLists.reduce((n, l) => n + (l._count?.tasks || 0), 0) +
    folders.reduce((n, f) => n + f.lists.reduce((m, l) => m + (l._count?.tasks || 0), 0), 0);

  async function createList() {
    const name = newList.trim();
    if (!name) { setAddingList(false); return; }
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, spaceId: id }),
    });
    setNewList("");
    setAddingList(false);
    load();
  }

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>{wsName || "Espaço"}</div>
          <div className="fx-title" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: color, display: "inline-block" }} />
            {sp?.name || "Espaço"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, fontSize: 12.5, color: "var(--txt-faint)" }}>
          <span><b style={{ color: "var(--txt)" }}>{folders.length}</b> pastas</span>
          <span><b style={{ color: "var(--txt)" }}>{totalLists}</b> listas</span>
          <span><b style={{ color: "var(--txt)" }}>{totalTasks}</b> tarefas</span>
        </div>
      </div>
      <div className="fx-accent" style={{ background: color }} />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 48px" }}>
        {loading && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {!loading && !sp && <p style={{ color: "var(--txt-faint)" }}>Espaço não encontrado ou sem acesso.</p>}

        {sp && (
          <>
            {/* PASTAS */}
            {folders.length > 0 && (
              <Section title="Pastas">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {folders.map((f) => {
                    const open = openFolder === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setOpenFolder(open ? null : f.id)}
                        className="fx-hoverable"
                        style={{ background: "var(--surface)", border: `1px solid ${open ? color : "var(--line)"}`, borderRadius: "var(--r-card)", padding: "13px 15px", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 17 }}>📁</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                          <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{open ? "▾" : "▸"}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 4 }}>{f.lists.length} {f.lists.length === 1 ? "lista" : "listas"}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Listas da pasta aberta */}
                {openFolder && (() => {
                  const f = folders.find((x) => x.id === openFolder);
                  if (!f) return null;
                  return (
                    <div style={{ marginTop: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
                      <div style={{ padding: "11px 15px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                        📁 {f.name}
                      </div>
                      {f.lists.map((l) => <ListRow key={l.id} l={l} color={color} onOpen={() => router.push(`/list/${l.id}`)} />)}
                      {f.lists.length === 0 && <p style={{ padding: "10px 15px", fontSize: 13, color: "var(--txt-faint)", borderTop: "1px solid var(--line)" }}>Nenhuma lista nesta pasta.</p>}
                    </div>
                  );
                })()}
              </Section>
            )}

            {/* LISTAS */}
            <Section title="Listas">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {looseLists.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => router.push(`/list/${l.id}`)}
                    className="fx-hoverable"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 15px", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 5 }}>{l._count?.tasks ?? 0} tarefas</div>
                  </div>
                ))}

                {/* + Lista */}
                {addingList ? (
                  <input
                    autoFocus
                    className="fx-input"
                    style={{ fontSize: 13 }}
                    value={newList}
                    onChange={(e) => setNewList(e.target.value)}
                    onBlur={createList}
                    onKeyDown={(e) => { if (e.key === "Enter") createList(); if (e.key === "Escape") { setNewList(""); setAddingList(false); } }}
                    placeholder="Nome da lista"
                  />
                ) : (
                  <button
                    onClick={() => setAddingList(true)}
                    style={{ background: "none", border: "1.5px dashed var(--line)", borderRadius: "var(--r-card)", padding: "14px 15px", color: "var(--txt-soft)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                  >
                    + Lista
                  </button>
                )}
              </div>
              {looseLists.length === 0 && folders.length === 0 && (
                <p style={{ color: "var(--txt-faint)", marginTop: 4 }}>Nenhuma lista solta neste espaço.</p>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--txt-soft)", marginBottom: 11 }}>{title}</div>
      {children}
    </div>
  );
}

function ListRow({ l, color, onOpen }: { l: ListLite; color: string; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="fx-hoverable"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 15px", cursor: "pointer", fontSize: 13.5, borderTop: "1px solid var(--line)" }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
      <span style={{ fontSize: 11, color: "var(--txt-faint)", background: "var(--col)", borderRadius: 999, padding: "1px 8px" }}>{l._count?.tasks ?? 0}</span>
    </div>
  );
}
