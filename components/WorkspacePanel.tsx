"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceT, SpaceT, ListLite } from "@/lib/types";

const SPACE_COLORS = ["#9250ac", "#ff7e59", "#1d9e75", "#534ab7", "#d85a30", "#3b82f6", "#ec4899", "#f59e0b"];

export default function WorkspacePanel({ id }: { id: string }) {
  const router = useRouter();
  const [ws, setWs] = useState<WorkspaceT | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hierarchy")
      .then((r) => r.json())
      .then((d) => setWs((d.workspaces || []).find((w: WorkspaceT) => w.id === id) || null))
      .finally(() => setLoading(false));
  }, [id]);

  function allLists(sp: SpaceT): ListLite[] {
    return [...sp.lists, ...sp.folders.flatMap((f) => f.lists)];
  }

  const totalSpaces = ws?.spaces.length || 0;
  const totalLists = ws ? ws.spaces.reduce((n, sp) => n + allLists(sp).length, 0) : 0;
  const totalTasks = ws
    ? ws.spaces.reduce((n, sp) => n + allLists(sp).reduce((m, l) => m + (l._count?.tasks || 0), 0), 0)
    : 0;

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Workspace</div>
          <div className="fx-title">{ws?.name || "Workspace"}</div>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 48px" }}>
        {loading && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {!loading && !ws && <p style={{ color: "var(--txt-faint)" }}>Workspace não encontrado ou sem acesso.</p>}

        {ws && (
          <>
            <div style={{ display: "flex", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
              <Stat label="Espaços" value={totalSpaces} />
              <Stat label="Listas" value={totalLists} />
              <Stat label="Tarefas" value={totalTasks} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {ws.spaces.map((sp, i) => {
                const color = sp.color || SPACE_COLORS[i % SPACE_COLORS.length];
                const lists = allLists(sp);
                return (
                  <div key={sp.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 15px", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ width: 11, height: 11, borderRadius: 4, background: color, flexShrink: 0 }} />
                      <span className="serif" style={{ fontSize: 16, fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sp.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{lists.length} {lists.length === 1 ? "lista" : "listas"}</span>
                    </div>
                    <div>
                      {lists.length === 0 && <p style={{ padding: "12px 15px", fontSize: 13, color: "var(--txt-faint)" }}>Nenhuma lista neste espaço.</p>}
                      {lists.map((l) => (
                        <div
                          key={l.id}
                          onClick={() => router.push(`/list/${l.id}`)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 15px", cursor: "pointer", fontSize: 13.5, borderTop: "1px solid var(--line)" }}
                          className="fx-hoverable"
                        >
                          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                          <span style={{ fontSize: 11, color: "var(--txt-faint)", background: "var(--col)", borderRadius: 999, padding: "1px 8px" }}>{l._count?.tasks ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {ws.spaces.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum espaço ainda.</p>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 20px", minWidth: 110 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "var(--txt)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
    </div>
  );
}
